LoanRepo — files to deploy
==========================

Upload everything in this folder to your repo root, preserving the _ds path
exactly. Render: Static Site, no build command, publish directory "./".

  index.html        the app
  Ebook.html        the book (the app links to it; sample gate lives here)
  support.js        page runtime — without it the page renders raw {{ }}
  supabase-client.js
  supabase-config.js
  doc-page.js       paged-document shell the book is built on
  _ds/industry-0aee6b66-0396-4d31-a389-4f4990a07af6/styles.css
  _ds/industry-0aee6b66-0396-4d31-a389-4f4990a07af6/_ds_bundle.js

The _ds folder name must not change and the leading underscore must survive
the upload — that path is referenced relatively from both pages.

In this revision
----------------
- The printed PDF is a document, not a screen capture: no nav, no buttons,
  no input form; a header carrying the loan particulars and the real
  preparation date; the bank message printing in full; and a closing note on
  method and assumptions.
- Nothing promoting the book prints.
- Share graphic: the added years show as a hatched band again.
- Chapter numbers corrected throughout, site and book.
