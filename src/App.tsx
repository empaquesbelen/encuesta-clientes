import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Check, ChevronDown, CircleHelp, LogOut, RefreshCw, Send, Sparkles } from 'lucide-react'
import { collection, doc, getDocs, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore'
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
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

const advisors = ['Alonso Jimenez', 'Aaron Soto', 'Jordan Chacón', 'Julián Salazar', 'Nelson Mora', 'Diego Segura', 'Stephanie Gonzales', 'Emanuel Bustos'] as const

const totalSteps = questions.length + 1
const codeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateSurveyCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return `EB-${Array.from(bytes, (byte) => codeAlphabet[byte % codeAlphabet.length]).join('')}`
}

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
const auth = firebaseApp ? getAuth(firebaseApp) : null

type SurveyResponse = {
  id: string
  name: string
  code?: string
  advisor?: string
  answers: Record<string, Answer>
  comment: string
  submittedAt?: { toDate: () => Date }
}

async function saveResponse(name: string, answers: Record<string, Answer>, comment: string, advisor: string) {
  // El código es también el ID del documento: las reglas impiden sobrescribir uno existente, lo que garantiza unicidad.
  const code = generateSurveyCode()
  const payload = {
    code,
    name: name.trim(),
    advisor,
    answers,
    comment: comment.trim(),
    submittedAt: serverTimestamp(),
    source: 'encuesta-satisfaccion-web',
  }

  if (database) {
    await setDoc(doc(database, 'encuestas_satisfaccion', code), payload)
    return code
  }

  const saved = JSON.parse(localStorage.getItem('encuestas-pendientes') ?? '[]')
  localStorage.setItem('encuestas-pendientes', JSON.stringify([...saved, payload]))
  return code
}

function AdminPage() {
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [responses, setResponses] = useState<SurveyResponse[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, setUser)
  }, [])

  async function loadResponses() {
    if (!database) {
      setError('Firebase no está configurado en este entorno.')
      return
    }
    setIsLoading(true)
    setError('')
    try {
      const snapshot = await getDocs(collection(database, 'encuestas_satisfaccion'))
      const loaded = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }) as SurveyResponse)
      loaded.sort((a, b) => (b.submittedAt?.toDate().getTime() ?? 0) - (a.submittedAt?.toDate().getTime() ?? 0))
      setResponses(loaded)
    } catch {
      setError('No se pudieron cargar las respuestas. Verifica que tu cuenta tenga acceso.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (user) void loadResponses()
  }, [user])

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!auth) {
      setError('Firebase no está configurado en este entorno.')
      return
    }
    setError('')
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
      setPassword('')
    } catch {
      setError('Correo o contraseña incorrectos.')
    }
  }

  if (!user) {
    return <main className="admin-shell"><header className="brand-header"><img src="/logo.webp" alt="Empaques Belén" /></header><section className="admin-login"><span className="admin-kicker">Panel de administración</span><h1>Respuestas de clientes</h1><p>Ingresa con una cuenta autorizada para consultar la encuesta.</p><form onSubmit={login}><label htmlFor="admin-email">Correo electrónico</label><input id="admin-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /><label htmlFor="admin-password">Contraseña</label><input id="admin-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" /><button className="next-button" type="submit">Ingresar <ArrowRight size={17} /></button></form>{error && <p className="form-error" role="alert"><CircleHelp size={16} /> {error}</p>}</section></main>
  }

  return <main className="admin-shell"><header className="admin-header"><img src="/logo.webp" alt="Empaques Belén" /><div><span>{user.email}</span><button className="back-button" onClick={() => auth && void signOut(auth)}><LogOut size={16} /> Salir</button></div></header><section className="admin-content"><div className="admin-title-row"><div><span className="admin-kicker">Panel de administración</span><h1>Respuestas recibidas</h1><p>{responses.length} {responses.length === 1 ? 'respuesta' : 'respuestas'} registradas</p></div><button className="refresh-button" onClick={() => void loadResponses()} disabled={isLoading}><RefreshCw size={16} className={isLoading ? 'spin' : ''} /> Actualizar</button></div>{error && <p className="form-error" role="alert"><CircleHelp size={16} /> {error}</p>}<div className="response-list">{responses.length === 0 && !isLoading && <div className="empty-state">Todavía no hay respuestas registradas.</div>}{responses.map((response, index) => <article className="response-card" key={response.id}><div className="response-card-header"><div><strong>Encuesta #{responses.length - index}{response.code && <span className="response-code">{response.code}</span>}</strong><span className="respondent-name">{response.name || 'Nombre pendiente'}</span><span className="respondent-advisor">Asesor: {response.advisor || 'No registrado'}</span></div><span>{response.submittedAt ? response.submittedAt.toDate().toLocaleString('es-CR') : 'Fecha pendiente'}</span></div><div className="answer-grid">{questions.map((question) => <div className="answer-item" key={question.id}><span>{question.category} · {question.id}</span><strong>{response.answers?.[question.id] ?? 'Sin respuesta'}</strong></div>)}</div>{response.comment && <div className="response-comment"><span>Comentario</span><p>{response.comment}</p></div>}<small>ID: {response.id}</small></article>)}</div></section></main>
}

function App() {
  if (window.location.pathname === '/admin') return <AdminPage />

  const [current, setCurrent] = useState(0)
  const [customerName, setCustomerName] = useState('')
  const [started, setStarted] = useState(false)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [advisor, setAdvisor] = useState('')
  const [comment, setComment] = useState('')
  const [consent, setConsent] = useState(false)
  const [surveyCode, setSurveyCode] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const isLast = current === totalSteps - 1
  const question = isLast ? null : questions[current]
  const selected = question ? answers[question.id] : undefined
  const progress = Math.round(((current + 1) / totalSteps) * 100)

  function startSurvey() {
    if (customerName.trim().length < 2) {
      setError('Escribe el nombre a quien facturas para continuar.')
      return
    }
    setError('')
    setStarted(true)
  }

  function chooseAnswer(answer: Answer) {
    if (!question) return
    setAnswers((previous) => ({ ...previous, [question.id]: answer }))
    setError('')
  }

  function goNext() {
    if (!selected) {
      setError('Selecciona una opción para continuar.')
      return
    }
    setCurrent((value) => Math.min(value + 1, totalSteps - 1))
    setError('')
  }

  async function submit() {
    if (!advisor) {
      setError('Selecciona el asesor que te atiende.')
      return
    }
    if (!consent) {
      setError('Marca la casilla para continuar.')
      return
    }

    setIsSaving(true)
    setError('')
    try {
      setSurveyCode(await saveResponse(customerName, answers, comment, advisor))
    } catch {
      setError('No pudimos enviar tus respuestas. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setIsSaving(false)
    }
  }

  if (surveyCode) {
    return (
      <main className="page-shell success-shell">
        <header className="brand-header"><img src="/logo.webp" alt="Empaques Belén" /></header>
        <section className="success-card" aria-live="polite">
          <div className="success-icon"><Check size={30} strokeWidth={2.5} /></div>
          <p className="eyebrow">Encuesta recibida</p>
          <h1>Gracias por ayudarnos a mejorar.</h1>
          <p className="success-copy">Tus respuestas fueron recibidas correctamente.</p>
          <div className="survey-code"><span>Tu código de participación</span><strong>{surveyCode}</strong><small>Guárdalo o tómale una captura de pantalla.</small></div>
          <div className="coupon-note"><Sparkles size={18} /><span>Tu ejecutivo de ventas te entregará un cupón para participar en la rifa. Muéstrale este código para validarlo.</span></div>
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
          <p>En Empaques Belén queremos conocer cómo vives tu experiencia con nuestros productos, precios y servicio. Tus respuestas nos ayudan a identificar qué hacemos bien y qué debemos mejorar para atenderte cada vez mejor.</p>
          <p className="intro-note">Solo te tomará 2 minutos. Al finalizar participas en la rifa entre quienes respondan.</p>
        </section>
        <section className="survey-panel" aria-label="Encuesta de satisfacción">
          {!started ? <div className="welcome-step"><div className="survey-topline"><span>Antes de comenzar</span><strong>2 min</strong></div><div className="question-heading"><span className="category-label">Participa en la rifa</span><h2>¿A nombre de quién facturas?</h2></div><p className="step-copy">Lo usaremos para identificar tu participación en el sorteo.</p><label className="field-label" htmlFor="customer-name">Nombre a quien facturas</label><input className="text-input" id="customer-name" value={customerName} onChange={(event) => { setCustomerName(event.target.value); setError('') }} maxLength={120} autoComplete="organization" placeholder="Nombre de la persona o empresa" /><div className="survey-actions"><button className="next-button" onClick={startSurvey}>Comenzar <ArrowRight size={17} /></button></div></div> : <><div className="survey-topline"><span>Pregunta {current + 1} de {totalSteps}</span><strong>{progress}%</strong></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
          {question ? <><div className="question-heading"><span className="category-label">{question.category}</span><h2>{question.title}</h2></div><div className="scale-list" role="radiogroup" aria-label="Escala de satisfacción">
            {scale.map((option, index) => (
              <button key={option} className={`scale-option ${selected === option ? 'selected' : ''}`} onClick={() => chooseAnswer(option)} role="radio" aria-checked={selected === option}>
                <span className="scale-number">{index + 1}</span><span>{option}</span>{selected === option && <Check size={17} />}
              </button>
            ))}
          </div></> : <><div className="question-heading"><span className="category-label">Atención</span><h2>¿Cuál es el nombre del asesor que le atiende?</h2></div>
            <div className="select-wrap"><select className={`text-input advisor-select ${advisor ? '' : 'is-empty'}`} id="advisor" aria-label="Asesor que le atiende" value={advisor} onChange={(event) => { setAdvisor(event.target.value); setError('') }}>
              <option value="" disabled>Selecciona un asesor</option>
              {advisors.map((name) => <option key={name} value={name}>{name}</option>)}
            </select><ChevronDown size={17} /></div></>}
          {isLast && <div className="last-step-fields">
            <label htmlFor="comment">¿Hay algún comentario que nos ayude a mejorar? <span>Opcional</span></label>
            <textarea id="comment" maxLength={500} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Cuéntanos lo que quieras compartir..." />
            <label className="consent-check"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>Autorizo el uso confidencial de mis respuestas para fines internos de mejora.</span></label>
          </div>}
          <div className="survey-actions">
            {current > 0 && <button className="back-button" onClick={() => setCurrent((value) => value - 1)}><ArrowLeft size={17} /> Atrás</button>}
            {!isLast ? <button className="next-button" onClick={goNext}>Siguiente <ArrowRight size={17} /></button> : <button className="next-button" onClick={submit} disabled={isSaving}>{isSaving ? 'Enviando...' : <>Enviar encuesta <Send size={16} /></>}</button>}
          </div></>}
          {error && <p className="form-error" role="alert"><CircleHelp size={16} /> {error}</p>}
        </section>
      </div>
      <footer className="page-footer"><span>Empaques Belén S.A.</span></footer>
    </main>
  )
}

export default App
