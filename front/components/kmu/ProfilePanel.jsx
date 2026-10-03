"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STUDENT_TYPES, SCHOOLS, GRADES, DEMO_PROFILES } from "@/data/profile";
import { validateKeyword } from "@/lib/profile";
import { InterestSelector } from "./InterestSelector";
export function ProfilePanel({
  profile: profile,
  onChange: onChange,
  onStudentType: onStudentType,
  onToggleInterest: onToggleInterest,
  onAddCustom: onAddCustom,
  onRemoveCustom: onRemoveCustom,
  onPreset: onPreset,
  onSearch: onSearch,
  searching: searching,
  buttonLabel = "내 공지 찾기",
}) {
  const [keywordInput, setKeywordInput] = React.useState("");
  const [keywordError, setKeywordError] = React.useState("");
  const colleges = Object.keys(SCHOOLS[profile.studentType]);
  const majors = SCHOOLS[profile.studentType][profile.college] || [];
  const addKeyword = (d) => {
    d.preventDefault();
    const c = validateKeyword(keywordInput, profile.keywords);
    if (!c.ok) return setKeywordError(c.error);
    onChange({
      keywords: [...profile.keywords, c.value],
    });
    setKeywordInput("");
    setKeywordError("");
  };
  return (
    <aside>
      <form
        className="profile-form"
        onSubmit={(d) => {
          d.preventDefault();
          onSearch();
        }}
      >
        <div className="form-head">
          <strong>{"내 학사 정보"}</strong>
          <span className="demo-badge">{"MY PROFILE"}</span>
        </div>
        <div
          className="chips flex flex-wrap gap-1.5"
          style={{
            marginBottom: 14,
          }}
          aria-label="데모 프로필"
        >
          {Object.entries(DEMO_PROFILES).map(([d, c]) => (
            <Button
              variant="original"
              key={d}
              type="button"
              className="chip"
              onClick={() => onPreset(d)}
            >
              {c.label}
            </Button>
          ))}
        </div>
        <div className="field-grid">
          <label>
            <span>{"학적"}</span>
            <select
              value={profile.studentType}
              onChange={(d) => onStudentType(d.target.value)}
            >
              {STUDENT_TYPES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{"학년"}</span>
            <select
              value={profile.grade}
              onChange={(d) =>
                onChange({
                  grade: Number(d.target.value),
                })
              }
            >
              {GRADES[profile.studentType].map((d) => (
                <option key={d} value={d}>
                  {d}
                  {"학년"}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>
              {profile.studentType === "대학원" ? "대학원" : "단과대학"}
            </span>
            <select
              value={profile.college}
              onChange={(d) =>
                onChange({
                  college: d.target.value,
                  major: SCHOOLS[profile.studentType][d.target.value][0],
                })
              }
            >
              {colleges.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{"전공"}</span>
            <select
              value={profile.major}
              onChange={(d) =>
                onChange({
                  major: d.target.value,
                })
              }
            >
              {majors.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
        </div>
        <InterestSelector
          selected={profile.interests}
          customInterests={profile.customInterests}
          onToggle={onToggleInterest}
          onAddCustom={onAddCustom}
          onRemoveCustom={onRemoveCustom}
        />
        <div className="field-block">
          <div className="label">
            <span>{"관심 키워드"}</span>
            <em>
              {profile.keywords.length}
              {"개"}
            </em>
          </div>
          <div className="chips flex flex-wrap gap-1.5">
            {profile.keywords.map((d) => (
              <span key={d} className="chip active">
                {d}
                <Button
                  variant="original"
                  type="button"
                  className="chip-x"
                  aria-label={`${d} 삭제`}
                  onClick={() =>
                    onChange({
                      keywords: profile.keywords.filter((c) => c !== d),
                    })
                  }
                >
                  {"×"}
                </Button>
              </span>
            ))}
          </div>
          <div className="add-row">
            <Input
              original={true}
              className="text-input"
              value={keywordInput}
              maxLength={30}
              placeholder="키워드 추가 (예: AI, 해커톤)"
              aria-label="관심 키워드 추가"
              onChange={(d) => {
                setKeywordInput(d.target.value);
                setKeywordError("");
              }}
              onKeyDown={(d) => {
                if (d.key === "Enter") {
                  addKeyword(d);
                }
              }}
            />
            <Button
              variant="original"
              type="button"
              className="add-btn"
              onClick={addKeyword}
            >
              {"추가"}
            </Button>
          </div>
          <p className="field-msg">{keywordError}</p>
        </div>
        <Button
          variant="original"
          className="primary-btn"
          type="submit"
          disabled={searching}
        >
          {searching ? "공지를 분석하는 중…" : buttonLabel}
        </Button>
      </form>
    </aside>
  );
}
