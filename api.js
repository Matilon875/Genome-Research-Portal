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