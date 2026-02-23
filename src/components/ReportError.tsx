"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { submitErrorReport, type ErrorReportResult } from "@/app/concept/report-action";

interface Props {
  conceptSlug: string;
  conceptTitle: string;
}

export default function ReportError({ conceptSlug, conceptTitle }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const [loadedAt, setLoadedAt] = useState(0);

  useEffect(() => {
    if (isOpen) setLoadedAt(Date.now());
  }, [isOpen]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;

    setStatus("sending");
    setErrorMsg("");

    const formData = new FormData(e.currentTarget);
    formData.set("_t", String(loadedAt));
    formData.set("concept_slug", conceptSlug);
    formData.set("concept_title", conceptTitle);

    const result: ErrorReportResult = await submitErrorReport(formData);

    if (result.success) {
      setStatus("sent");
      formRef.current?.reset();
    } else {
      setStatus("error");
      setErrorMsg(result.error || "שגיאה לא צפויה");
    }
  }

  return (
    <div className="mt-6">
      {!isOpen && status !== "sent" && (
        <button
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          מצאת טעות? דווח/י לנו
        </button>
      )}

      <AnimatePresence>
        {isOpen && status !== "sent" && (
          <motion.form
            ref={formRef}
            onSubmit={handleSubmit}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  דיווח על טעות או אי-דיוק
                </h3>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="סגור"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-5 w-5"
                  >
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                </button>
              </div>

              {/* Honeypot */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
              />

              <textarea
                name="description"
                required
                maxLength={1000}
                rows={3}
                placeholder="תאר/י את הטעות או אי-הדיוק..."
                className="mb-3 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />

              <input
                type="email"
                name="reporter_email"
                placeholder="אימייל ליצירת קשר (לא חובה)"
                className="mb-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />

              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  הדיווח יישלח לצוות קנאפדיה לבדיקה
                </p>
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="inline-flex min-h-[36px] items-center rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {status === "sending" ? "שולח..." : "שלח דיווח"}
                </button>
              </div>

              {status === "error" && (
                <p className="mt-2 text-sm text-red-500">{errorMsg}</p>
              )}
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {status === "sent" && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 text-sm text-green-600"
        >
          תודה! הדיווח התקבל ויטופל בהקדם.
        </motion.p>
      )}
    </div>
  );
}
