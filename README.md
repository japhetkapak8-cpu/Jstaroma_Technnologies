# Jstaroma_Technnologies

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

Run the project link regression tests with Node.js (no dependencies required):

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