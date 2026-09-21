# Encuesta de satisfacción | Empaques Belén

Aplicación web de la encuesta de satisfacción de clientes, construida con React, TypeScript y Vite.

## Desarrollo

```bash
npm install
npm run dev
```

Sin variables de Firebase, las respuestas se guardan temporalmente en el almacenamiento local del navegador para permitir revisar la experiencia. Para persistencia real, copia `.env.example` como `.env` y agrega la configuración de Firebase Web.

La estructura inicial se crea con el SDK Admin:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = ".\encuesta-satisfaccion-5210f-firebase-adminsdk-fbsvc-199a6f73a4.json"
npm run seed:firestore
```

Esto crea `configuracion/encuesta_actual` y `configuracion/esquema_respuestas`. Las respuestas se guardan en `encuestas_satisfaccion`.

## Netlify

- Build command: `npm run build`
- Publish directory: `dist`
- Agrega en Netlify las seis variables `VITE_FIREBASE_*` de `.env.example`.
- En Firebase, habilita Firestore y crea reglas de escritura para la colección `encuestas_satisfaccion`.

Las reglas versionadas están en `firestore.rules`. Para publicarlas, la cuenta usada debe tener el rol IAM `Firebase Rules Admin` (`roles/firebaserules.admin`) y luego se puede ejecutar `npm run deploy:firestore-rules`. La cuenta Admin no debe subirse al repositorio ni configurarse como variable `VITE_*`.

La aplicación no solicita nombre, correo ni datos de contacto. Las respuestas se almacenan con fecha, valoraciones y comentario opcional para el análisis interno.
