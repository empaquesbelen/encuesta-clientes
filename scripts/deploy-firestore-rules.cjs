const fs = require('node:fs')
const path = require('node:path')
const { GoogleAuth } = require('google-auth-library')

const projectId = 'encuesta-satisfaccion-5210f'
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
if (!credentialsPath) {
  throw new Error('Define GOOGLE_APPLICATION_CREDENTIALS con la ruta al JSON del SDK Admin.')
}

async function main() {
  const auth = new GoogleAuth({
    keyFile: path.resolve(credentialsPath),
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  })
  const client = await auth.getClient()
  const token = (await client.getAccessToken()).token
  const rules = fs.readFileSync(path.resolve('firestore.rules'), 'utf8')
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  const rulesetResponse = await fetch(`https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ source: { files: [{ name: 'firestore.rules', content: rules }] } }),
  })
  const ruleset = await rulesetResponse.json()
  if (!rulesetResponse.ok) throw new Error(JSON.stringify(ruleset))

  // La publicación `cloud.firestore` ya existe, así que se actualiza (PATCH).
  // Crearla de nuevo exigiría el permiso firebaserules.releases.create, que no hace falta aquí.
  const releaseName = `projects/${projectId}/releases/cloud.firestore`
  const releaseResponse = await fetch(`https://firebaserules.googleapis.com/v1/${releaseName}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ release: { name: releaseName, rulesetName: ruleset.name }, updateMask: 'rulesetName' }),
  })
  const release = await releaseResponse.json()
  if (!releaseResponse.ok) throw new Error(JSON.stringify(release))
  console.log(`Rules publicadas: ${release.name} (${release.rulesetName})`)
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
