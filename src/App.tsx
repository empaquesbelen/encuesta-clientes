import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, CircleHelp, Send, Sparkles } from 'lucide-react'
import { collection, addDoc, getFirestore, serverTimestamp } from 'firebase/firestore'
import { initializeApp } from 'firebase/app'

const scale = ['Malo', 'Regular', 'Bueno', 'Muy bueno', 'Excelente'] as const

type Answer = (typeof scale)[number]
type Question = { id: string; category: string; title: string; helper?: string }

const questions: Question[] = [
  { id: 'variedad', category: 'Producto', title: '¿Qué tan satisfecho está con la variedad de productos de nuestro catálogo?' },
  { id: 'uso', category: 'Producto', title: '¿Qué tan satisfecho está con el uso que las personas usuarias finales dan al producto?' },
  { id: 'presentacion', category: 'Producto', title: '¿Cómo evalúa la limpieza, orden y presentación de los productos al momento de la entrega?' },
  { id: 'cantidades', category: 'Producto', title: '¿Recibe las cantidades adecuadas y la documentación correcta junto con su pedido?' },
  { id: 'precio-mercado', category: 'Precio', title: '¿Cómo evalúa la competitividad de nuestros precios frente al resto del mercado?' },
  { id: 'precio-calidad', category: 'Precio', title: '¿Cómo evalúa la relación entre el precio y la calidad del producto?' },
  { id: 'preventa', category: 'Servicio', title: '¿Cómo califica la gestión de preventa de nuestro equipo de ventas?' },
  { id: 'call-center', category: 'Servicio', title: '¿Cómo califica la gestión de ventas en nuestro call center?' },
  { id: 'entrega', category: 'Servicio', title: '¿Qué tan satisfecho está con el servicio de entrega de mercadería?' },
  { id: 'cobro', category: 'Servicio', title: '¿Cómo evalúa la gestión de crédito y cobro de la compañía?' },
  { id: 'disconformidades', category: 'Servicio', title: '¿Cómo evalúa la atención y seguimiento de quejas por disconformidades?' },
  { id: 'devolucion', category: 'Servicio', title: '¿Qué tan satisfecho está con nuestra política de devolución de mercadería?' },
]

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean)
const firebaseApp = hasFirebaseConfig ? initializeApp(firebaseConfig) : null
const database = firebaseApp ? getFirestore(firebaseApp) : null

async function saveResponse(answers: Record<string, Answer>, comment: string) {
  const payload = {
    answers,
    comment: comment.trim(),
    submittedAt: serverTimestamp(),
    source: 'encuesta-satisfaccion-web',
  }

  if (database) {
    await addDoc(collection(database, 'encuestas_satisfaccion'), payload)
    return
  }

  const saved = JSON.parse(localStorage.getItem('encuestas-pendientes') ?? '[]')
  localStorage.setItem('encuestas-pendientes', JSON.stringify([...saved, payload]))
}

function App() {
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [comment, setComment] = useState('')
  const [consent, setConsent] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const question = questions[current]
  const selected = answers[question.id]
  const isLast = current === questions.length - 1
  const progress = Math.round(((current + 1) / questions.length) * 100)

  function chooseAnswer(answer: Answer) {
    setAnswers((previous) => ({ ...previous, [question.id]: answer }))
    setError('')
  }

  function goNext() {
    if (!selected) {
      setError('Selecciona una opción para continuar.')
      return
    }
    setCurrent((value) => Math.min(value + 1, questions.length - 1))
    setError('')
  }

  async function submit() {
    if (!selected) {
      setError('Selecciona una opción para continuar.')
      return
    }
    if (!consent) {
      setError('Marca la casilla para continuar.')
      return
    }

    setIsSaving(true)
    setError('')
    try {
      await saveResponse(answers, comment)
      setSubmitted(true)
    } catch {
      setError('No pudimos enviar tus respuestas. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setIsSaving(false)
    }
  }

  if (submitted) {
    return (
      <main className="page-shell success-shell">
        <header className="brand-header"><img src="/logo.webp" alt="Empaques Belén" /></header>
        <section className="success-card" aria-live="polite">
          <div className="success-icon"><Check size={30} strokeWidth={2.5} /></div>
          <p className="eyebrow">Encuesta recibida</p>
          <h1>Gracias por ayudarnos a mejorar.</h1>
          <p className="success-copy">Tus respuestas fueron recibidas correctamente.</p>
          <div className="coupon-note"><Sparkles size={18} /><span>Tu ejecutivo de ventas te entregará un cupón para participar en la rifa.</span></div>
        </section>
        <footer className="page-footer">Empaques Belén S.A. · Tu experiencia nos importa</footer>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <header className="brand-header"><img src="/logo.webp" alt="Empaques Belén" /></header>
      <div className="intro-grid">
        <section className="intro-copy">
          <div className="eyebrow"><span className="eyebrow-mark" /> Encuesta de satisfacción 2026</div>
          <h1>Tu opinión<br /><em>cuenta.</em></h1>
          <p>Queremos conocer tu experiencia para seguir entregando productos y servicio a la altura de tu negocio.</p>
        </section>
        <section className="survey-panel" aria-label="Encuesta de satisfacción">
          <div className="survey-topline"><span>Pregunta {current + 1} de {questions.length}</span><strong>{progress}%</strong></div>
          <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
          <div className="question-heading"><span className="category-label">{question.category}</span><h2>{question.title}</h2></div>
          <div className="scale-list" role="radiogroup" aria-label="Escala de satisfacción">
            {scale.map((option, index) => (
              <button key={option} className={`scale-option ${selected === option ? 'selected' : ''}`} onClick={() => chooseAnswer(option)} role="radio" aria-checked={selected === option}>
                <span className="scale-number">{index + 1}</span><span>{option}</span>{selected === option && <Check size={17} />}
              </button>
            ))}
          </div>
          {isLast && <div className="last-step-fields">
            <label htmlFor="comment">¿Hay algún comentario que nos ayude a mejorar? <span>Opcional</span></label>
            <textarea id="comment" maxLength={500} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Cuéntanos lo que quieras compartir..." />
            <label className="consent-check"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>Autorizo el uso confidencial de mis respuestas para fines internos de mejora.</span></label>
          </div>}
          {error && <p className="form-error" role="alert"><CircleHelp size={16} /> {error}</p>}
          <div className="survey-actions">
            {current > 0 && <button className="back-button" onClick={() => setCurrent((value) => value - 1)}><ArrowLeft size={17} /> Atrás</button>}
            {!isLast ? <button className="next-button" onClick={goNext}>Siguiente <ArrowRight size={17} /></button> : <button className="next-button" onClick={submit} disabled={isSaving}>{isSaving ? 'Enviando...' : <>Enviar encuesta <Send size={16} /></>}</button>}
          </div>
        </section>
      </div>
      <footer className="page-footer"><span>Empaques Belén S.A.</span></footer>
    </main>
  )
}

export default App
