const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSG9EwZOm8IDP1-nV9A_q7FLudwMgho8h0jkL4_Qb12upZ-Cj3NrxQtGPLxJA16Ey7S0vdawLi2dRC4/pub?gid=540515133&single=true&output=csv';
const FETCH_TIMEOUT_MS = 20000;

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\r') {
      // se ignora, el salto de línea real lo maneja \n
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter(cells => cells.some(cell => cell !== ''));
}

function formatPrice(value) {
  const num = Number(value) || 0;
  return `S/ ${num.toFixed(2)}`;
}

function rowsToProducts(rows) {
  const [header, ...dataRows] = rows;

  return dataRows.map(cells => {
    const row = {};
    header.forEach((key, i) => {
      row[key] = cells[i];
    });

    const product = {
      name: row['Nombre'] || '',
      category: row['Marca'] || '',
      tag: '',
      desc: '',
      price: formatPrice(row['Precio Final']),
      image: row['Imagen'] || ''
    };

    if (String(row['Disponible']).trim().toLowerCase() === 'no') {
      product.agotado = true;
    }

    return product;
  });
}

async function fetchProducts() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(CSV_URL, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Error ${response.status} al cargar el catálogo`);
    }
    const text = await response.text();
    return rowsToProducts(parseCSV(text));
  } finally {
    clearTimeout(timeoutId);
  }
}

// Cachea la promesa para no volver a pedir las 3200+ filas cada vez que se llama.
let productsPromise = null;

export function getProducts() {
  if (!productsPromise) {
    productsPromise = fetchProducts().catch(error => {
      productsPromise = null;
      throw error;
    });
  }
  return productsPromise;
}
