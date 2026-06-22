"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type PubHtmlRootProps = {
  styles: string;
  html: string;
};

function bindRecordInteractions(root: HTMLElement) {
  const distText = root.querySelector("#distText");
  const goalFill = root.querySelector<HTMLElement>("#goalFill");
  const goalCurr = root.querySelector("#goalCurr");
  const goalPct = root.querySelector("#goalPct");
  const goalRemain = root.querySelector("#goalRemain");

  if (!distText) {
    return;
  }

  const GOAL = 25000;
  const ACCUM_BEFORE = 18500;
  let dist = 1500;

  function fmt(n: number) {
    return n.toLocaleString("en-US");
  }

  function render() {
    if (!distText) {
      return;
    }
    distText.textContent = fmt(dist);
    distText.classList.toggle("empty", dist === 0);

    if (goalFill && goalCurr && goalPct && goalRemain) {
      const total = ACCUM_BEFORE + dist;
      const pct = Math.min(100, Math.round((total / GOAL) * 100));
      goalFill.style.width = `${pct}%`;
      goalCurr.textContent = fmt(total);
      goalPct.textContent = `${pct}%`;
      goalRemain.textContent = `${fmt(Math.max(0, GOAL - total))}m`;
    }
  }

  root.querySelectorAll<HTMLElement>(".quick-btn").forEach((button) => {
    button.addEventListener("click", () => {
      dist += Number.parseInt(button.dataset.add ?? "0", 10);
      if (dist > 99999) {
        dist = 99999;
      }
      render();
    });
  });

  root.querySelectorAll<HTMLElement>(".dist-step").forEach((button) => {
    button.addEventListener("click", () => {
      const step = button.dataset.step;
      if (step === "reset") {
        dist = 0;
      } else {
        dist = Math.max(0, dist + Number.parseInt(step ?? "0", 10));
      }
      render();
    });
  });

  root.querySelectorAll<HTMLElement>("#strokeRow .stroke").forEach((chip) => {
    chip.addEventListener("click", () => chip.classList.toggle("on"));
  });

  root.querySelectorAll<HTMLElement>("#privacyRow .priv").forEach((chip) => {
    chip.addEventListener("click", () => {
      root.querySelectorAll("#privacyRow .priv").forEach((item) => {
        item.classList.remove("on");
      });
      chip.classList.add("on");
    });
  });

  const memo = root.querySelector<HTMLTextAreaElement>("#memo");
  const memoLen = root.querySelector("#memoLen");
  if (memo && memoLen) {
    const updateMemo = () => {
      memoLen.textContent = String(memo.value.length);
      memoLen.parentElement?.classList.toggle("warn", memo.value.length >= 90);
    };
    memo.addEventListener("input", updateMemo);
    updateMemo();
  }

  function setState(state: "form" | "success") {
    root.dataset.state = state;
    root.querySelector("#stForm")?.classList.toggle("on", state === "form");
    root.querySelector("#stSuccess")?.classList.toggle("on", state === "success");
  }

  root.querySelector("#stForm")?.addEventListener("click", () => setState("form"));
  root.querySelector("#stSuccess")?.addEventListener("click", () => setState("success"));
  root.querySelector("#saveBtn")?.addEventListener("click", () => setState("success"));
  root.querySelector("#saveShareBtn")?.addEventListener("click", () => setState("success"));
  root.querySelector("#recordAgain")?.addEventListener("click", () => setState("form"));

  render();
}

export function PubHtmlRoot({ styles, html }: PubHtmlRootProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const cleanups: Array<() => void> = [];

    root.querySelectorAll("[data-nav-back]").forEach((element) => {
      const handler = (event: Event) => {
        event.preventDefault();
        router.back();
      };
      element.addEventListener("click", handler);
      cleanups.push(() => element.removeEventListener("click", handler));
    });

    root.querySelectorAll("[data-href]").forEach((element) => {
      const handler = (event: Event) => {
        event.preventDefault();
        const href = element.getAttribute("data-href");
        if (href) {
          router.push(href);
        }
      };
      element.addEventListener("click", handler);
      cleanups.push(() => element.removeEventListener("click", handler));
    });

    root.querySelectorAll("form").forEach((form) => {
      const handler = (event: Event) => {
        event.preventDefault();
      };
      form.addEventListener("submit", handler);
      cleanups.push(() => form.removeEventListener("submit", handler));
    });

    bindRecordInteractions(root);

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [html, router]);

  return (
    <>
      {styles ? <style dangerouslySetInnerHTML={{ __html: styles }} /> : null}
      <div
        ref={rootRef}
        className="pub-html-root"
        data-state="form"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}
