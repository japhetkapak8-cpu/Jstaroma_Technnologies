# Jstaroma_Technnologies

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