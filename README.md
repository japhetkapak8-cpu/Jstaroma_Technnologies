# Jstaroma_Technnologies

## Project images and documents

Visitors can click a project image to open the full-size original in a new tab.
**View full project** includes **Download Image**, plus **View Document** and
**Download Document** when a document is attached. Existing project links remain
available.

Before deploying, apply
[`supabase/migrations/20261030_add_project_documents.sql`](supabase/migrations/20261030_add_project_documents.sql)
in Supabase. It adds optional document fields and a public `project-documents`
bucket with admin-only uploads/deletions and a 10 MB limit. Attached documents
are public files; do not upload confidential material, even to draft projects.

In **Admin > Projects**, use **Project Document** to attach one PDF or Word file
(`.pdf`, `.doc`, `.docx`). Leave it blank when editing to keep the current file,
choose another file to replace it, or select **Remove current document**.
Replaced/removed documents and deleted projects' documents are cleaned up from
storage. Failed database saves roll back new uploads and report errors.

## Project Play Store links

Before deploying the updated project pages, apply
[`supabase/migrations/20261026_add_project_play_store_link.sql`](supabase/migrations/20261026_add_project_play_store_link.sql)
to the site's Supabase database (using your migration workflow or the SQL Editor).
This adds the optional `projects.play_store_url` column without changing existing projects.

In **Admin > Projects**, paste an app's Google Play URL into **Google Play Store URL**
when adding or editing a project, then save it. For published projects, visitors
can select **View full project > Get it on Google Play** on the website.
Leaving the field blank hides the button; clearing it on an existing project removes
the link.

## Product Play Store links

Before deploying the updated product page, apply
[`supabase/migrations/20261027_add_product_play_store_link.sql`](supabase/migrations/20261027_add_product_play_store_link.sql)
to the site's Supabase database. This adds the optional `products.play_store_url`
column without changing existing products.

In **Admin > Products**, enter a product's Google Play URL in **Google Play Store URL**.
Published products with a URL show a **Download on Google Play** button; products
without one keep their existing contact action, and Wantok Chat continues to show
that its Play Store link is coming soon.

## Product lifecycle statuses

Before deploying product lifecycle statuses, apply
[`supabase/migrations/20261027_add_product_lifecycle_status.sql`](supabase/migrations/20261027_add_product_lifecycle_status.sql)
to the site's Supabase database. Existing products are assigned **Published** when
they have stock and **Coming Soon** otherwise.

In **Admin > Products**, choose **Coming Soon**, **In Progress**, **In Production**,
or **Published** in the Product Status field. This status is shown on the public
product card; the separate Published toggle still controls whether the product is
visible on the site.

Run the project link, image and document regression tests with Node.js (no dependencies required):

```sh
node --experimental-vm-modules --test admin/js/tests/project-links.test.cjs
```

## Admin content counts

The dashboard loads exact database counts for projects, achievements, and products
after admin authentication. Drafts are all records that are not published.
Product and achievement management pages load all result pages before calculating
their totals; search and filters do not change the overview counts. Failed loads
show an error rather than a zero or partial total.

Run the admin count regression tests with Node.js (no dependencies required):

```sh
node --experimental-vm-modules --test admin/js/tests/content-stats.test.cjs
```