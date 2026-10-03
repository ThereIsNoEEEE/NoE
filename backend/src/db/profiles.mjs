import { randomUUID } from 'node:crypto';
import { ApiError } from '../http.mjs';
import { QdrantError } from './qdrant.mjs';
import { validateId, validateProfile } from './profile-schema.mjs';

export class ProfilesRepository {
  constructor(client, collection) {
    this.client = client;
    this.collection = collection;
    this.initializing = null;
  }

  async ensureCollection() {
    // Share concurrent initialization; retry on the next request after failure.
    if (!this.initializing) {
      this.initializing = (async () => {
        let info;
        try { info = await this.client.collection(this.collection); }
        catch (error) {
          if (!(error instanceof QdrantError) || error.status !== 404) throw error;
          try { await this.client.createCollection(this.collection); }
          catch (createError) {
            // Another process may have created the collection concurrently.
            if (!(createError instanceof QdrantError) || ![400, 409].includes(createError.status)) throw createError;
          }
          info = await this.client.collection(this.collection);
        }
        const vectors = info?.config?.params?.vectors;
        if (!vectors || typeof vectors !== 'object' || Object.keys(vectors).length) {
          throw new ApiError(503, 'DB_SCHEMA_MISMATCH', '프로필 전용 payload-only 컬렉션을 사용하세요. 기존 컬렉션은 변경하지 않았습니다.');
        }
      })().catch(error => { this.initializing = null; throw error; });
    }
    return this.initializing;
  }

  async create(input) {
    const profile = validateProfile(input);
    await this.ensureCollection();
    const id = randomUUID(), now = new Date().toISOString();
    const payload = { kind: 'academic_profile', schemaVersion: 1, profile, createdAt: now, updatedAt: now };
    await this.client.upsert(this.collection, id, payload);
    return { id, ...payload };
  }

  async get(rawId) {
    const id = validateId(rawId);
    let point;
    try { point = await this.client.point(this.collection, id); }
    catch (error) {
      if (!(error instanceof QdrantError) || error.status !== 404) throw error;
      throw new ApiError(404, 'PROFILE_NOT_FOUND', '저장된 학사 정보를 찾을 수 없습니다.');
    }
    if (point?.payload?.kind !== 'academic_profile') throw new ApiError(404, 'PROFILE_NOT_FOUND', '저장된 학사 정보를 찾을 수 없습니다.');
    const { kind, schemaVersion, profile, createdAt, updatedAt } = point.payload;
    return { id, kind, schemaVersion, profile, createdAt, updatedAt };
  }

  async update(id, input) {
    const profile = validateProfile(input);
    const previous = await this.get(id);
    const { id: storedId, ...payload } = { ...previous, profile, updatedAt: new Date().toISOString() };
    await this.client.upsert(this.collection, storedId, payload);
    return { id: storedId, ...payload };
  }
}
