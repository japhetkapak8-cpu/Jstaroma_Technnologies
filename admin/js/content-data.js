const PAGE_SIZE = 1000;

export async function loadAllRows(createQuery) {
  const rows = [];

  while (true) {
    const { data, count, error } = await createQuery()
      .range(rows.length, rows.length + PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    if (!Array.isArray(data) || !Number.isInteger(count) || count < 0) {
      throw new Error("Content query did not return rows and an exact count.");
    }

    rows.push(...data);

    if (rows.length >= count) {
      return rows;
    }

    if (data.length === 0) {
      throw new Error("Content loading stopped before all rows were returned.");
    }
  }
}

export async function loadPublicationStats(client, table) {
  const [totalResult, publishedResult] = await Promise.all([
    client.from(table).select("*", { count: "exact", head: true }),
    client.from(table).select("*", { count: "exact", head: true })
      .eq("published", true)
  ]);

  if (totalResult.error || publishedResult.error) {
    throw totalResult.error || publishedResult.error;
  }

  if (!Number.isInteger(totalResult.count) || !Number.isInteger(publishedResult.count)) {
    throw new Error(`No counts returned for ${table}.`);
  }

  return {
    total: totalResult.count,
    published: publishedResult.count,
    drafts: totalResult.count - publishedResult.count
  };
}
