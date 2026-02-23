"use client";

import { useState, useRef, useEffect } from "react";
import { submitContact } from "./actions";
import type { ContactResult } from "./actions";

interface Props {
  clientIp: string;
}

export default function ContactForm({ clientIp }: Props) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const loadedAt = useRef(Date.now());
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    loadedAt.current = Date.now();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    const formData = new FormData(e.currentTarget);
    formData.set("_t", String(loadedAt.current));
    formData.set("_ip", clientIp);

    const result: ContactResult = await submitContact(formData);

    if (result.success) {
      setStatus("sent");
      formRef.current?.reset();
    } else {
      setStatus("error");
      setErrorMsg(result.error || "שגיאה לא צפויה.");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
        <span className="mb-3 block text-4xl" aria-hidden="true">✅</span>
        <h2 className="mb-2 text-xl font-bold text-green-900">ההודעה נשלחה בהצלחה</h2>
        <p className="text-sm text-green-800">תודה על הפנייה! נחזור אליכם בהקדם.</p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-6 rounded-xl border border-green-300 bg-white px-6 py-2.5 text-sm font-medium text-green-800 transition-colors hover:bg-green-50"
        >
          שליחת הודעה נוספת
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Honeypot — invisible to humans, bots auto-fill it */}
      <div className="absolute -left-[9999px] opacity-0" aria-hidden="true">
        <label htmlFor="website">אל תמלא שדה זה</label>
        <input type="text" id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-foreground">
          שם מלא <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={100}
          placeholder="ישראל ישראלי"
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground shadow-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">
            אימייל <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            maxLength={200}
            placeholder="email@example.com"
            dir="ltr"
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground shadow-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-foreground">
            טלפון
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            maxLength={20}
            placeholder="050-0000000"
            dir="ltr"
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground shadow-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div>
        <label htmlFor="message" className="mb-1.5 block text-sm font-medium text-foreground">
          תוכן ההודעה <span className="text-red-500">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          required
          maxLength={5000}
          rows={5}
          placeholder="כתבו את הודעתכם כאן..."
          className="w-full resize-y rounded-xl border border-border bg-card px-4 py-3 text-base leading-7 text-foreground shadow-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="flex items-start gap-3">
        <input
          id="consent"
          name="consent"
          type="checkbox"
          required
          className="mt-1 h-4 w-4 shrink-0 rounded border-border text-primary accent-primary focus:ring-primary/20"
        />
        <label htmlFor="consent" className="text-sm leading-6 text-muted-foreground">
          קראתי ואני מסכים/ה ל<a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">מדיניות הפרטיות ותנאי השימוש</a> <span className="text-red-500">*</span>
        </label>
      </div>

      {status === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-all hover:bg-primary/90 active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status === "sending" ? "שולח..." : "שליחת הודעה"}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        המידע שתמסרו ישמש ליצירת קשר בלבד ולא יועבר לגורם שלישי.
      </p>
    </form>
  );
}
