//////////////////////////////
// 🧬 ENSEMBL API
//////////////////////////////

async function getGeneEnsembl(gene) {
  const url = `https://rest.ensembl.org/lookup/symbol/homo_sapiens/${gene}?content-type=application/json`;

  const res = await fetch(url);
  const data = await res.json();

  return data;
}

//////////////////////////////
// 🧬 NCBI - BUSCAR GEN
//////////////////////////////

async function getGeneNCBI(gene) {
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=gene&term=${gene}[gene]+AND+homo+sapiens&retmode=json`;

  const res = await fetch(url);
  const data = await res.json();

  return data.esearchresult.idlist[0];
}
//////////////////////////////
// 🧬 NCBI - DETALLE DEL GEN
//////////////////////////////

async function getGeneSummaryNCBI(id) {
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=gene&id=${id}&retmode=json`;

  const res = await fetch(url);
  const data = await res.json();

  return data.result[id];
}

//////////////////////////////
// 📄 PUBMED - BUSCAR PAPER
//////////////////////////////

async function searchPubMedPapers(query, retmax = 5) {
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=${retmax}&sort=relevance`;

  const res = await fetch(url);
  const data = await res.json();

  return data.esearchresult?.idlist || [];
}

//////////////////////////////
// 📄 PUBMED - DETALLES
//////////////////////////////

async function getPubMedSummaries(ids) {
  if (!ids || !ids.length) return [];

  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`;

  const res = await fetch(url);
  const data = await res.json();
  const result = data.result || {};

  return ids.map((id) => result[id]).filter(Boolean);
}
