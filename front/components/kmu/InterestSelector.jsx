"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_INTERESTS } from "@/data/profile";
export function InterestSelector({
  selected: selected,
  customInterests: customInterests,
  onToggle: onToggle,
  onAddCustom: onAddCustom,
  onRemoveCustom: onRemoveCustom,
  compact = false,
}) {
  const [interestInput, setInterestInput] = React.useState("");
  const [feedback, setFeedback] = React.useState({
    text: "",
    ok: !1,
  });
  const handleAdd = (p) => {
    p.preventDefault();
    const h = onAddCustom(interestInput);
    if (h.ok) {
      setInterestInput("");
      setFeedback({
        text: `'${h.value}' 추가됨 · 바로 선택했어요`,
        ok: !0,
      });
    } else {
      setFeedback({
        text: h.error,
        ok: !1,
      });
    }
  };
  return (
    <div className={`field-block${compact ? " compact-interests" : ""}`}>
      <div className="label">
        <span>{"관심 분야 (복수 선택)"}</span>
        <em>
          {selected.length}
          {"개 선택"}
        </em>
      </div>
      <div className="chips flex flex-wrap gap-1.5">
        {DEFAULT_INTERESTS.map((p) => (
          <Button
            variant="original"
            key={p}
            type="button"
            className={`chip${selected.includes(p) ? " active" : ""}`}
            aria-pressed={selected.includes(p)}
            onClick={() => onToggle(p)}
          >
            {p}
          </Button>
        ))}
        {(compact ? [] : customInterests).map((p) => (
          <span
            key={p}
            className={`chip custom${selected.includes(p) ? " active" : ""}`}
          >
            <Button
              variant="original"
              type="button"
              className="chip-x"
              style={{
                padding: 0,
                fontSize: ".74rem",
                fontWeight: "inherit",
                opacity: 1,
              }}
              aria-pressed={selected.includes(p)}
              onClick={() => onToggle(p)}
            >
              {p}
            </Button>
            <Button
              variant="original"
              type="button"
              className="chip-x"
              aria-label={`${p} 삭제`}
              onClick={() => onRemoveCustom(p)}
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
          value={interestInput}
          maxLength={30}
          placeholder="직접 추가 (예: 금융, 창업, 봉사)"
          aria-label="관심 분야 직접 추가"
          onChange={(p) => {
            setInterestInput(p.target.value);
            setFeedback({
              text: "",
              ok: !1,
            });
          }}
          onKeyDown={(p) => {
            if (p.key === "Enter") {
              handleAdd(p);
            }
          }}
        />
        <Button
          variant="original"
          type="button"
          className="add-btn"
          onClick={handleAdd}
        >
          {"추가"}
        </Button>
      </div>
      <p className={`field-msg${feedback.ok ? " ok" : ""}`} role="status">
        {feedback.text}
      </p>
      {selected.length === 0 && (
        <p className="warn-line">
          {"관심 분야를 1개 이상 선택하면 추천이 정확해져요."}
        </p>
      )}
    </div>
  );
}
