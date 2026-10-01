const path = require('node:path')
const admin = require('firebase-admin')
const ExcelJS = require('exceljs')

// Con --dry-run solo se lee el Excel y se reporta lo que se cargaría, sin tocar Firestore.
const argumentos = process.argv.slice(2)
const soloLectura = argumentos.includes('--dry-run')
const workbookPath = path.resolve(argumentos.find((argumento) => !argumento.startsWith('--')) ?? 'Cliente.xlsx')

let db = null
if (!soloLectura) {
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!serviceAccountPath) {
    throw new Error('Define GOOGLE_APPLICATION_CREDENTIALS con la ruta al JSON del SDK Admin.')
  }
  admin.initializeApp({ credential: admin.credential.cert(require(path.resolve(serviceAccountPath))) })
  db = admin.firestore()
}

// La cédula se usa como ID del documento, así que debe quedar siempre igual:
// sin espacios, guiones ni puntos, y en mayúsculas (hay pasaportes y cédulas jurídicas con letras).
function normalizarCedula(valor) {
  return String(valor ?? '').replace(/[^0-9a-zA-Z]/g, '').toUpperCase()
}

function textoDeCelda(celda) {
  const valor = celda?.value
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'object') return String(valor.result ?? valor.text ?? valor.richText?.map((parte) => parte.text).join('') ?? '').trim()
  return String(valor).trim()
}

async function main() {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(workbookPath)
  const sheet = workbook.worksheets[0]

  const clientes = new Map()
  const omitidos = []
  const duplicados = []

  sheet.eachRow((row, numero) => {
    if (numero === 1) return
    const codigo = textoDeCelda(row.getCell(1))
    const nombre = textoDeCelda(row.getCell(2))
    const cedula = textoDeCelda(row.getCell(3))
    const vendedor = textoDeCelda(row.getCell(4))
    if (!codigo && !nombre && !cedula && !vendedor) return

    const id = normalizarCedula(cedula)
    if (!id || !nombre || !vendedor) {
      omitidos.push({ fila: numero, codigo, nombre, cedula, vendedor })
      return
    }
    if (clientes.has(id)) {
      duplicados.push({ fila: numero, cedula, nombre, previo: clientes.get(id).nombre })
      return
    }
    clientes.set(id, { codigo, nombre, cedula, vendedor })
  })

  const entradas = [...clientes.entries()]
  for (let inicio = 0; !soloLectura && inicio < entradas.length; inicio += 400) {
    const lote = db.batch()
    for (const [id, cliente] of entradas.slice(inicio, inicio + 400)) {
      lote.set(db.collection('clientes').doc(id), {
        ...cliente,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
    }
    await lote.commit()
    console.log(`Cargados ${Math.min(inicio + 400, entradas.length)} de ${entradas.length} clientes`)
  }

  const vendedores = [...new Set(entradas.map(([, cliente]) => cliente.vendedor))].sort()
  if (!soloLectura) {
    await db.collection('configuracion').doc('encuesta_actual').set({
      vendedores,
      clientesCargados: entradas.length,
      clientesActualizadosEn: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
  }

  console.log(`\n${soloLectura ? 'Clientes listos para cargar' : 'Clientes en Firestore'}: ${entradas.length}`)
  console.log(`Vendedores: ${vendedores.join(', ')}`)
  if (duplicados.length > 0) {
    console.log(`\nCédulas repetidas (se conservó la primera): ${duplicados.length}`)
    duplicados.forEach((fila) => console.log(`  fila ${fila.fila}: ${fila.cedula} · ${fila.nombre} (ya estaba como ${fila.previo})`))
  }
  if (omitidos.length > 0) {
    console.log(`\nFilas omitidas por datos incompletos: ${omitidos.length}`)
    omitidos.forEach((fila) => console.log(`  fila ${fila.fila}: ${fila.codigo} · ${fila.nombre} · cédula "${fila.cedula}" · ${fila.vendedor}`))
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
