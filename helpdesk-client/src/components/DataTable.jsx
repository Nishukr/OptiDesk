// src/components/DataTable.jsx — one data set, two layouts.
//
// A table is the right shape for a 24" monitor and the wrong shape for a
// phone: eight columns cannot be read at 375px without scrolling sideways.
// So this renders a real <table> from 768px up (Tailwind's `md`) and a stack
// of cards below that — the table is never in the DOM on mobile, so there is
// nothing wide left to scroll.
//
// Both layouts are generated from ONE `columns` array, so a column is
// described once and the two views cannot drift apart. `mobile` decides where
// a column lands inside the card:
//
//   'title'    bold, first — the thing you tapped for (subject, customer name)
//   'header'   full-width rich block, no label (avatar + email, say)
//   'badge'    colour-coded chip; all badges share one wrapping row
//   'meta'     label / value pair in the detail grid            (the default)
//   'actions'  buttons, in a thumb-friendly row pinned to the bottom
//   'hide'     desktop only — noise on a phone
//
// Column shape: { key, header, cell(row), thClass?, tdClass?, mobile? }
import { Fragment } from 'react';

function pick(columns, slot) {
  return columns.filter((c) => (c.mobile || 'meta') === slot);
}

export default function DataTable({ columns, rows, rowKey, loading = false, empty = null, label }) {
  // Loading and empty are hoisted out of both layouts. Rendering them inside
  // the <tbody> means a colSpan that has to be kept equal to columns.length
  // by hand — a silent layout bug every time a column is added.
  if (loading) return <p className="py-9 text-center text-ink-500">Loading…</p>;
  if (!rows.length) return empty;

  const titles = pick(columns, 'title');
  const headers = pick(columns, 'header');
  const badges = pick(columns, 'badge');
  const metas = pick(columns, 'meta');
  const actions = pick(columns, 'actions');

  return (
    <>
      {/* ---------- desktop: dense, scannable, one row per record ---------- */}
      <div className="hidden overflow-x-auto md:block">
        <table className="table" aria-label={label}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={c.thClass}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((c) => (
                  <td key={c.key} className={c.tdClass}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---------- mobile: one card per record, nothing off-screen ----------
          flex-col, not `grid`: `grid` is ALSO a legacy class in index.css
          (auto-fit, minmax(min(320px,100%),1fr), gap 20px) and legacy CSS is
          unlayered, so it outranks layer(utilities) — it would override both
          `gap-3` and any grid-template utility here. */}
      <ul className="m-0 flex list-none flex-col gap-3 p-0 md:hidden" aria-label={label}>
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            className="min-w-0 rounded-lg border border-line bg-surface p-4 shadow-card"
          >
            {titles.map((c) => (
              <div
                key={c.key}
                // The subject link is the card's primary tap target, so it gets
                // the 44px minimum too — a 19px line of text does not.
                className="flex min-w-0 flex-wrap items-center gap-x-2 text-[0.98rem] leading-snug font-semibold break-words text-ink-900 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center"
              >
                {c.cell(row)}
              </div>
            ))}

            {badges.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {badges.map((c) => (
                  <Fragment key={c.key}>{c.cell(row)}</Fragment>
                ))}
              </div>
            )}

            {headers.map((c) => (
              <div key={c.key} className="mt-3 min-w-0 border-t border-line pt-3">
                {c.cell(row)}
              </div>
            ))}

            {metas.length > 0 && (
              // One flex row per pair — label left, value right. A <div>
              // wrapping each dt/dd group is valid HTML5 inside <dl>, and it
              // avoids `grid` entirely for the same layer reason as the <ul>.
              <dl className="mt-3 mb-0 flex flex-col gap-2 border-t border-line pt-3 text-[0.85rem]">
                {metas.map((c) => (
                  <div key={c.key} className="flex items-baseline justify-between gap-4">
                    <dt className="shrink-0 text-ink-500">{c.header}</dt>
                    <dd className="m-0 min-w-0 text-right font-medium break-words text-ink-900">
                      {c.cell(row)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            {actions.length > 0 && (
              // grow + basis-24 lets 2–3 short buttons share a row and wrap
              // instead of stacking into a tall column; min-height comes from
              // the 44px touch-target rule in index.css.
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3 [&>*]:grow [&>*]:basis-24">
                {actions.map((c) => (
                  <Fragment key={c.key}>{c.cell(row)}</Fragment>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
