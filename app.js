/* ──────────────────────────────────────────────────────────────────────
   MolGPT – UI script
   • Handles mode switching and contextual help text
   • Shows / hides the scaffold-input + upload chunk for Scaffold Decoration
   • Live-updates the slider read-out, file-name read-out
   • Sends one JSON payload to FastAPI, including an optional SMILES file
────────────────────────────────────────────────────────────────────────*/

/* 1.  Static help text for each mode */
const modeMessages = {
  "De Novo Generation": `
    <h3>Structural Input</h3>
    <p>Generate completely novel molecules from scratch based on desired properties.</p>
    <p>No structural inputs required. Configure property filters below to guide generation.</p>
  `,
  "Scaffold Decoration": `
    <h3>Scaffold Input</h3>
    <p>Decorate provided scaffolds with optimal R-groups.</p>
    <p>Upload a core structure, then set desired properties below.</p>
  `,
  "Fragment Linking": `
    <h3>Fragment Input</h3>
    <p>Link two fragments with novel linkers.</p>
    <p>Provide fragment SMILES, then tune filters to guide the linker design.</p>
  `,
  "Molecular Transformation": `
    <h3>Transformation Input</h3>
    <p>Suggest structurally similar molecules or modifications.</p>
    <p>Input your starting molecule, and adjust transformation settings below.</p>
  `,
  "Peptide Design": `
    <h3>Peptide Input</h3>
    <p>Generate peptide sequences matching your criteria.</p>
    <p>No structural input required. Adjust sequence and property constraints below.</p>
  `,
  "Select Mode": `
    <h3>Welcome to MolGPT</h3>
    <p>Select a mode to start generating.</p>
  `
};

/* 2. Initialise once DOM is ready */
document.addEventListener('DOMContentLoaded', () => {
  /* DOM refs ---------------------------------------------------------- */
  const dropdown         = document.querySelector('.select-mode-dropdown');
  const headerSpan       = dropdown.querySelector('.dropdown-header span');
  const dropdownItems    = dropdown.querySelectorAll('.dropdown-content a');

  const messageHolder    = document.getElementById('mode-message');
  const scaffoldRow      = document.getElementById('mode-scaffold-row');
  const scaffoldInputTxt = document.getElementById('scaffold-smiles');

  /* file-upload widgets (inside the scaffold row) */
  const fileInput        = document.getElementById('scaffold-file');
  const fileNameSpan     = document.querySelector('.file-upload__filename');

  const tempInput        = document.getElementById('temperature');
  const tempValue        = document.querySelector('.temp-value');
  const samplesInput     = document.getElementById('num-samples');

  /* ---------- helpers ----------------------------------------------- */
  function switchInputs(mode) {
    /* Show scaffold row iff mode === Scaffold Decoration */
    scaffoldRow.style.display = mode === 'Scaffold Decoration' ? 'flex' : 'none';
  }

  /* ---------- start-up state ---------------------------------------- */
  messageHolder.innerHTML = modeMessages['Select Mode'];
  switchInputs('Select Mode');

  /* ---------- dropdown behaviour ------------------------------------ */
  dropdown.querySelector('.dropdown-header')
          .addEventListener('click', () => dropdown.classList.toggle('open'));

  dropdown.querySelector('.menu-icon')
          .addEventListener('click', e => {
            e.stopPropagation();
            headerSpan.textContent = 'Select Mode';
            dropdown.classList.remove('open');
            messageHolder.innerHTML = modeMessages['Select Mode'];
            switchInputs('Select Mode');
          });

  dropdownItems.forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const modeName = item.querySelector('.item-text').textContent;
      headerSpan.textContent  = modeName;
      dropdown.classList.remove('open');
      messageHolder.innerHTML = modeMessages[modeName] || '';
      switchInputs(modeName);
    });
  });

  /* ---------- live controls ----------------------------------------- */
  tempInput.addEventListener('input', () => {
    tempValue.textContent = parseFloat(tempInput.value).toFixed(1);
  });

  samplesInput.addEventListener('focus', () => { samplesInput.value = ''; });
  samplesInput.addEventListener('blur',  () => {
    if (samplesInput.value === '') samplesInput.value = '0';
  });

  fileInput.addEventListener('change', () => {
    fileNameSpan.textContent = fileInput.files.length
      ? fileInput.files[0].name
      : 'No file chosen';
  });
});

/* 3.  Generate-button handler ---------------------------------------- */
document.getElementById('generateButton').addEventListener('click', async () => {
  const mode        = document.querySelector('.dropdown-header span').textContent;
  const samples     = +document.getElementById('num-samples').value;
  const temperature = +document.getElementById('temperature').value;

  const scaffold    = document.getElementById('scaffold-smiles').value.trim();
  const fileElem    = document.getElementById('scaffold-file');
  const file        = fileElem && fileElem.files.length ? fileElem.files[0] : null;

  const panel       = document.getElementById('results-panel');

  /* basic guardrails -------------------------------------------------- */
  if (!samples || samples < 1) {
    panel.textContent = 'Please enter a sample size ≥ 1.';
    return;
  }
  if (mode === 'Select Mode') {
    panel.textContent = 'Please choose a generator mode.';
    return;
  }

  panel.innerHTML = '<p>Generating … please wait ⏳</p>';

  try {
    /* read file if present */
    const scaffoldFileText = file ? await file.text() : null;

    const payload = {
      samples,
      temperature,
      mode,
      scaffold,
      scaffold_file_text: scaffoldFileText   // null or string
    };

    const res = await fetch('http://127.0.0.1:8000/generate-molecules', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await res.text());

    const { generated_molecules, total_generated, valid_molecules } = await res.json();

    panel.innerHTML = `
      <p>Generated ${total_generated} molecules, ${valid_molecules} valid.</p>
      <div id="mol-list"></div>
    `;
    const list = document.getElementById('mol-list');
    generated_molecules.forEach((m, i) => {
      list.insertAdjacentHTML(
        'beforeend',
        `<div><span>${i + 1}:</span> <code>${m.smiles}</code> ${m.valid ? '' : '<span style="color:red">(invalid)</span>'}</div>`
      );
    });
  } catch (err) {
    panel.innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
    console.error(err);
  }
});
