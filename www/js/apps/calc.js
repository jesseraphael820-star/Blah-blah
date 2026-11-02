// Calculator with keyboard support and history.

import { h } from "../core/util.js";

export default async function calc({ win }) {
  let expr = "", result = "0", just = false;
  const exprEl = h("div", { class: "calc-expr" });
  const resEl = h("div", { class: "calc-res" }, "0");
  const keys = ["C", "⌫", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "±", "0", ",", "="];
  const grid = h("div", { class: "calc-grid" }, keys.map((k) => h("button", { class: "calc-k" + ("÷×−+=".includes(k) ? " op" : "") + (k === "=" ? " eq" : ""), onclick: () => press(k) }, k)));
  win.body.append(h("div", { class: "calc", tabindex: 0 }, exprEl, resEl, grid));
  const safe = (e) => e.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/,/g, ".");
  function evalExpr(e) {
    const s = safe(e);
    if (!/^[\d.+\-*/%() ]*$/.test(s) || !s) return null;
    try { const v = Function(`"use strict";return (${s.replace(/(\d+(?:\.\d+)?)%/g, "($1/100)")})`)(); return Number.isFinite(v) ? +v.toPrecision(12) : "Erro"; } catch { return null; }
  }
  function press(k) {
    if (k === "C") { expr = ""; result = "0"; }
    else if (k === "⌫") expr = expr.slice(0, -1);
    else if (k === "=") { const v = evalExpr(expr); if (v != null) { exprEl.textContent = expr + " ="; result = String(v).replace(".", ","); expr = String(v).replace(".", ","); just = true; resEl.textContent = result; return; } }
    else if (k === "±") expr = expr.startsWith("−") ? expr.slice(1) : "−" + expr;
    else { if (just && /[\d,]/.test(k)) expr = ""; expr += k; }
    just = false;
    exprEl.textContent = expr;
    const v = evalExpr(expr);
    resEl.textContent = v != null ? String(v).replace(".", ",") : expr || "0";
  }
  win.body.addEventListener("keydown", (e) => {
    const map = { "*": "×", "/": "÷", "-": "−", ".": ",", Enter: "=", Backspace: "⌫", Escape: "C", Delete: "C" };
    const k = map[e.key] || e.key;
    if (keys.includes(k) || /^[\d+%]$/.test(k)) { e.preventDefault(); press(k); }
  });
  setTimeout(() => win.body.querySelector(".calc").focus(), 50);
  return {};
}
