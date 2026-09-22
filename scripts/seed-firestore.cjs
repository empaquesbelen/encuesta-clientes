const path = require('node:path')
const admin = require('firebase-admin')

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
if (!serviceAccountPath) {
  throw new Error('Define GOOGLE_APPLICATION_CREDENTIALS con la ruta al JSON del SDK Admin.')
}

const serviceAccount = require(path.resolve(serviceAccountPath))
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()

const questions = [
  { id: 'variedad', category: 'Producto', order: 1 },
  { id: 'uso', category: 'Producto', order: 2 },
  { id: 'presentacion', category: 'Producto', order: 3 },
  { id: 'cantidades', category: 'Producto', order: 4 },
  { id: 'precio-mercado', category: 'Precio', order: 5 },
  { id: 'precio-calidad', category: 'Precio', order: 6 },
  { id: 'preventa', category: 'Servicio', order: 7 },
  { id: 'call-center', category: 'Servicio', order: 8 },
  { id: 'entrega', category: 'Servicio', order: 9 },
  { id: 'cobro', category: 'Servicio', order: 10 },
  { id: 'disconformidades', category: 'Servicio', order: 11 },
  { id: 'devolucion', category: 'Servicio', order: 12 },
]

async function main() {
  const batch = db.batch()
  const configRef = db.collection('configuracion').doc('encuesta_actual')
  batch.set(configRef, {
    encuestaId: 'satisfaccion-2026',
    nombre: 'Encuesta de satisfacción de clientes',
    empresa: 'Empaques Belén S.A.',
    periodo: '2026',
    escala: ['Malo', 'Regular', 'Bueno', 'Muy bueno', 'Excelente'],
    metaCobertura: 171,
    poblacionObjetivo: 307,
    margenError: 0.05,
    nivelConfianza: 0.95,
    preguntas: questions,
    asesores: ['Alonso Jimenez', 'Aaron Soto', 'Jordan Chacón', 'Julián Salazar', 'Nelson Mora', 'Diego Segura', 'Stephanie Gonzales', 'Emanuel Bustos'],
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })

  const schemaRef = db.collection('configuracion').doc('esquema_respuestas')
  batch.set(schemaRef, {
    coleccion: 'encuestas_satisfaccion',
    campos: {
      code: 'Código único de la encuesta (EB-XXXXXXXX), igual al ID del documento',
      name: 'Nombre a quien se factura, máximo 120 caracteres',
      advisor: 'Asesor que atiende al cliente, de la lista configurada',
      answers: 'Mapa con 12 respuestas de escala',
      comment: 'Comentario opcional, máximo 500 caracteres',
      submittedAt: 'Marca de tiempo del servidor',
      source: 'Identificador fijo de la aplicación',
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })

  await batch.commit()
  console.log('Firestore inicializado: configuracion/encuesta_actual y configuracion/esquema_respuestas')
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
