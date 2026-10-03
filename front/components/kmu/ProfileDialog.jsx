"use client";

import { Children, cloneElement, isValidElement, useEffect, useRef, useState } from "react";

export function ProfileDialog({ open, onClose, children }) {
  const dialogRef = useRef(null);
  const [step, setStep] = useState(0);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);
  const fields = Children.map(children, child => isValidElement(child) && child.props.profile
    ? cloneElement(child, { onboardingStep: step, onNext: () => setStep(1) }) : child);
  return (
    <dialog ref={dialogRef} className="profile-dialog profile-wizard" aria-labelledby="profile-dialog-title" aria-describedby="profile-dialog-description" onCancel={onClose} onClose={onClose}>
      <header className="profile-dialog-head">
        <div>
          <div className="setup-progress" aria-label={`설정 ${step + 1}단계 / 2단계`}>
            <span className={step === 0 ? "current" : "complete"}>1 · 학사 정보</span>
            <span className={step === 1 ? "current" : ""}>2 · 관심 분야</span>
          </div>
          <h1 id="profile-dialog-title">{step === 0 ? "나에게 맞는 공지부터 받아보세요." : "어떤 기회에 관심 있나요?"}</h1>
          <p id="profile-dialog-description">{step === 0 ? "학적과 전공을 알려주시면 추천에 반영할게요." : "관심 분야를 1개 이상 선택해 주세요."}</p>
        </div>
        <button type="button" className="icon-btn dialog-close" onClick={onClose} aria-label="추천 기준 설정 닫기">×</button>
      </header>
      {fields}
      <footer className="setup-footer">
        {step === 1 ? <button type="button" className="setup-back" onClick={() => setStep(0)}>← 이전</button> : <span>키워드는 나의 정보에서 추가할 수 있어요.</span>}
        <button type="button" className="dialog-explore" onClick={onClose}>나중에 설정</button>
      </footer>
    </dialog>
  );
}
