let aiUsed = false;
let activePaperSource = "pubmed";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function updatePaperSourceButtons() {
  document.querySelectorAll(".paper-source-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.source === activePaperSource);
  });
}

function setPaperSource(source) {
  activePaperSource = source;
  updatePaperSourceButtons();

  const query = document.getElementById("paperInput")?.value.trim();
  if (query) {
    searchPaper();
  }
}

function getPaperSourceLabel(source) {
  if (source === "pmc") return "PubMed Central";
  if (source === "crossref") return "Crossref";
  return "PubMed";
}

function getCrossrefDate(item) {
  if (item?.publishedPrint?.["date-parts"]?.[0]?.length) {
    return item.publishedPrint["date-parts"][0].join("-");
  }

  if (item?.publishedOnline?.["date-parts"]?.[0]?.length) {
    return item.publishedOnline["date-parts"][0].join("-");
  }

  if (item?.issued?.["date-parts"]?.[0]?.length) {
    return item.issued["date-parts"][0].join("-");
  }

  return "Fecha no disponible";
}

function getArticleId(item, wantedTypes) {
  const ids = Array.isArray(item?.articleids) ? item.articleids : [];

  for (const wantedType of wantedTypes) {
    const match = ids.find((entry) => {
      const type = String(entry?.idtype || entry?.type || "").toLowerCase();
      return type === wantedType;
    });

    if (match) {
      return match.value || match.id || "";
    }
  }

  return "";
}

function renderPaperCards(papers) {
  return papers.map((paper) => `
    <article class="paper-card">
      <h2>${escapeHtml(paper.title)}</h2>
      <p><strong>Autores:</strong> ${escapeHtml(paper.authors)}</p>
      <p><strong>Revista:</strong> ${escapeHtml(paper.journal)}</p>
      <p><strong>Fecha:</strong> ${escapeHtml(paper.pubDate)}</p>
      <a href="${escapeHtml(paper.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(paper.linkLabel)}</a>
    </article>
  `).join("");
}
async function searchGene() {

  document.getElementById("output").innerHTML = `
    <div class="gene-card">
      <p>🔄 Cargando datos del gen...</p>
    </div>
  `;
aiUsed = false;
  const gene = document.getElementById("geneInput").value.trim();

  if (!gene) {
    document.getElementById("output").innerHTML = `
      <div class="gene-card">
        <p>❌ Por favor, introduce un nombre de gen</p>
      </div>
    `;
    return;
  }

  const [ensembl, ncbiId] = await Promise.all([
    getGeneEnsembl(gene),
    getGeneNCBI(gene)
  ]);

  // 🚨 VALIDACIÓN IMPORTANTE
  if (!ensembl || !ensembl.display_name) {
    document.getElementById("output").innerHTML = `
      <div class="gene-card">
        <h2>❌ Gen no encontrado</h2>
        <p>El gen "${gene}" no existe o está mal escrito.</p>
      </div>
    `;
    return;
  }

  let ncbiData = null;

  if (ncbiId) {
    ncbiData = await getGeneSummaryNCBI(ncbiId);
  }

  document.getElementById("output").innerHTML = `
    <div class="gene-card">

      <h2>${ensembl.display_name}</h2>

      <h3>📍 Ubicación genómica</h3>
      <p>Cromosoma: ${ensembl.seq_region_name}</p>
      <p>Inicio: ${ensembl.start}</p>
      <p>Fin: ${ensembl.end}</p>
      <p>Hebra: ${ensembl.strand}</p>

      <h3>🧬 Información de NCBI</h3>
      <p>Nombre: ${ncbiData?.name || "No disponible"}</p>
      <p>Descripción: ${ncbiData?.description || "Sin descripción disponible"}</p>

      <br>

      <!-- 🤖 SOLO SI ES VÁLIDO -->
     <button id="aiButton" onclick="explainGeneAI('${gene}')" ${aiUsed ? "disabled" : ""}>
        🤖 Explicar con IA
      </button>

      <div id="aiOutput"></div>

    </div>
  `;
}

/* =========================
   📚 BIBLIOGRAFÍA
========================= */
function toggleBibliography() {
  const panel = document.getElementById("bibliographyPanel");
  panel.classList.toggle("hidden");
}

/* =========================
   📄 PAPER SEARCH
========================= */
async function searchPaper() {
  const query = document.getElementById("paperInput").value.trim();
  const output = document.getElementById("paperOutput");
  const sourceLabel = getPaperSourceLabel(activePaperSource);

  if (!query) {
    output.innerHTML = `
      <div class="gene-card">
        <p>❌ Por favor, escribe un tema, gen o autor</p>
      </div>
    `;
    return;
  }

  output.innerHTML = `
    <div class="gene-card">
      <p>🔄 Buscando artículos en ${escapeHtml(sourceLabel)}...</p>
    </div>
  `;

  try {
    let papers = [];

    if (activePaperSource === "pmc") {
      const ids = await searchPMCPapers(query, 5);

      if (ids.length) {
        const rawPapers = await getPMCSummaries(ids);

        papers = rawPapers.map((paper) => {
          const pmcId = getArticleId(paper, ["pmc", "pmcid"]);
          const pmcid = pmcId || (String(paper.uid || "").startsWith("PMC") ? paper.uid : `PMC${paper.uid || ""}`);
          const authors = Array.isArray(paper.authors) && paper.authors.length
            ? paper.authors.slice(0, 5).map((author) => author.name).join(", ")
            : "Autores no disponibles";

          return {
            title: paper.title || "Sin título",
            authors,
            journal: paper.fulljournalname || paper.source || "Revista no disponible",
            pubDate: paper.pubdate || "Fecha no disponible",
            link: `https://pmc.ncbi.nlm.nih.gov/articles/${pmcid}/`,
            linkLabel: "Ver en PubMed Central"
          };
        });
      }
    } else if (activePaperSource === "crossref") {
      const items = await searchCrossrefPapers(query, 5);

      papers = items.map((item) => {
        const authors = Array.isArray(item.author) && item.author.length
          ? item.author.slice(0, 5).map((author) => [author.given, author.family].filter(Boolean).join(" ")).join(", ")
          : "Autores no disponibles";

        const journal = Array.isArray(item["container-title"]) && item["container-title"].length
          ? item["container-title"][0]
          : item.publisher || "Revista no disponible";

        const title = item.title?.[0] || "Sin título";
        const doi = item.DOI ? `https://doi.org/${item.DOI}` : item.URL || "https://search.crossref.org/";

        return {
          title,
          authors,
          journal,
          pubDate: getCrossrefDate(item),
          link: doi,
          linkLabel: "Ver registro"
        };
      });
    } else {
      const ids = await searchPubMedPapers(query, 5);

      if (ids.length) {
        const rawPapers = await getPubMedSummaries(ids);

        papers = rawPapers.map((paper) => {
          const authors = Array.isArray(paper.authors) && paper.authors.length
            ? paper.authors.slice(0, 5).map((author) => author.name).join(", ")
            : "Autores no disponibles";

          return {
            title: paper.title || "Sin título",
            authors,
            journal: paper.fulljournalname || paper.source || "Revista no disponible",
            pubDate: paper.pubdate || "Fecha no disponible",
            link: `https://pubmed.ncbi.nlm.nih.gov/${paper.uid}/`,
            linkLabel: "Ver en PubMed"
          };
        });
      }
    }

    if (!papers.length) {
      output.innerHTML = `
        <div class="gene-card">
          <h2>📄 Sin resultados</h2>
          <p>No se encontraron artículos en ${escapeHtml(sourceLabel)} para "${escapeHtml(query)}".</p>
        </div>
      `;
      return;
    }

    output.innerHTML = `
      <div class="paper-results">
        ${renderPaperCards(papers)}
      </div>
    `;
  } catch (error) {
    output.innerHTML = `
      <div class="gene-card">
        <h2>❌ Error al buscar papers</h2>
        <p>No se pudo conectar con ${escapeHtml(sourceLabel)} en este momento.</p>
      </div>
    `;
  }
}

/* =========================
   ⌨️ ENTER SEARCH
========================= */
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("geneInput");
  const paperInput = document.getElementById("paperInput");

  updatePaperSourceButtons();

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      searchGene();
    }
  });

  if (paperInput) {
    paperInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        searchPaper();
      }
    });
  }
});

/* =========================
   📘 GUIDE NAVIGATION
========================= */
function openGuidePage() {
  document.querySelector(".container").style.display = "none";
  document.getElementById("guidePage").classList.remove("hidden");
  document.getElementById("bibButton").classList.add("hidden");
  document.getElementById("paperButton").classList.add("hidden");
  document.getElementById("bibliographyPanel").classList.add("hidden");
  document.getElementById("paperPage").classList.add("hidden");
}

function closeGuidePage() {
  document.querySelector(".container").style.display = "flex";
  document.getElementById("guidePage").classList.add("hidden");
  document.getElementById("bibButton").classList.remove("hidden");
  document.getElementById("paperButton").classList.remove("hidden");
}

/* =========================
   📄 PAPER NAVIGATION
========================= */
function openPaperPage() {
  document.querySelector(".container").style.display = "none";
  document.getElementById("paperPage").classList.remove("hidden");
  document.getElementById("bibButton").classList.add("hidden");
  document.getElementById("paperButton").classList.add("hidden");
  document.getElementById("bibliographyPanel").classList.add("hidden");
  document.getElementById("guidePage").classList.add("hidden");
}

function closePaperPage() {
  document.querySelector(".container").style.display = "flex";
  document.getElementById("paperPage").classList.add("hidden");
  document.getElementById("bibButton").classList.remove("hidden");
  document.getElementById("paperButton").classList.remove("hidden");
}

/* =========================
   📖 GUIDE CONTENT
========================= */
function showSection(section) {
  const content = document.getElementById("guideContent");

  if (section === "location") {
    content.innerHTML = `
      <div class="guide-card">
        <h3>Dónde se localizan los genes</h3>
        <p>En el ser humano, el genoma principal se encuentra en el núcleo de las células, organizado en 46 cromosomas formados por ADN y proteínas (histonas).</p>
        <p>Este ADN nuclear contiene la mayoría de la información genética del organismo.</p>
        <p>Además, existe un pequeño genoma en las mitocondrias, llamado ADN mitocondrial, heredado casi siempre de la madre.</p>
        <p>El ADN mitocondrial está relacionado con la producción de energía celular (ATP).</p>
        <p>Todas las células con núcleo del cuerpo humano contienen el mismo genoma nuclear (salvo mutaciones).</p>
        <p>En conjunto, el genoma humano está distribuido entre el núcleo y las mitocondrias.</p>
      </div>
    `;
  }

  if (section === "what") {
    content.innerHTML = `
      <div class="guide-card">
        <h3>Qué es un genoma</h3>
       <p>El genoma es el conjunto completo de ADN que contiene las instrucciones genéticas necesarias para el desarrollo, funcionamiento y mantenimiento de un ser vivo. Está codificado en cuatro bases nitrogenadas (adenina, timina, citosina y guanina) y en humanos contiene aproximadamente 3.000 millones de pares de bases organizados en 23 pares de cromosomas dentro del núcleo celular en células somáticas.</p>

<p>Aproximadamente el 1–2% del genoma humano codifica genes, es decir, secuencias que contienen la información para sintetizar proteínas. El resto del ADN incluye regiones reguladoras, estructurales y repetitivas, muchas de las cuales participan en la regulación de la expresión génica o aún no se comprenden completamente.</p>

<p>El genoma dirige procesos como el desarrollo embrionario, la síntesis de proteínas y la función celular, contribuyendo a la identidad biológica de cada organismo. Algunas mutaciones pueden alterar estas instrucciones y causar enfermedades, aunque muchas otras no tienen efectos detectables.</p>
      </div>
    `;
  }

  if (section === "ai") {
    content.innerHTML = `
      <div class="guide-card">
        <h3>IA</h3>
        <p>Usa el botón de IA dentro de cada búsqueda para ampliar la información.</p>
      </div>
    `;
  }

  if (section === "table") {
  content.innerHTML = `
    <div class="guide-card">
      <h3>Cómo entender la tabla de genes</h3>

      <p><b>Cromosoma:</b> indica en qué cromosoma está el gen (ej: 1–23).</p>

      <p><b>Inicio:</b> posición donde empieza el gen en el ADN.</p>

      <p><b>Fin:</b> posición donde termina el gen.</p>

      <p><b>Hebra:</b> dirección del ADN (+ o -).</p>

      <p><b>Nombre:</b> nombre del gen (ej: BRCA1).</p>

      <p><b>Descripción:</b> función del gen en el organismo.</p>

    </div>
  `;
}
}

/* =========================
   🤖 AI (RAILWAY)
========================= */
async function explainGeneAI(gene) {
 
  if (aiUsed) return;

aiUsed = true;
  document.getElementById("aiOutput").innerHTML = `
    <div class="guide-card">
      <p>🤖 Pensando...</p>
    </div>
  `;

  try {
    const res = await fetch("https://genoma-production-2104.up.railway.app/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: `Explícame el gen ${gene}`,
        npc: "presente"
      })
    });

    const data = await res.json();

    document.getElementById("aiOutput").innerHTML = `
      <div class="guide-card">
        <h3>🤖 Explicación con IA</h3>
        <p>${data.reply}</p>
      </div>
    `;

  } catch (error) {
    document.getElementById("aiOutput").innerHTML = `
      <div class="guide-card">
        <p>❌ Error al conectar con la IA</p>
      </div>
    `;
  }
}
document.querySelectorAll("button").forEach(btn => {
  btn.addEventListener("click", () => {

    // color activo (azul brillante)
    btn.style.background = "#60a5fa";
    btn.style.color = "#0b1220";
    btn.style.transform = "scale(0.96)";

    setTimeout(() => {
      // vuelve al estilo normal
      btn.style.background = "";
      btn.style.color = "";
      btn.style.transform = "";
    }, 150);

  });
});
