# Encuesta de satisfacción | Empaques Belén

Aplicación web de la encuesta de satisfacción de clientes, construida con React, TypeScript y Vite.

## Desarrollo

```bash
npm install
npm run dev
```

Sin variables de Firebase, las respuestas se guardan temporalmente en el almacenamiento local del navegador y la búsqueda por cédula devuelve un cliente de prueba, para poder revisar la experiencia completa. Para persistencia real, copia `.env.example` como `.env` y agrega la configuración de Firebase Web.

La estructura inicial se crea con el SDK Admin:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = ".\encuesta-satisfaccion-5210f-firebase-adminsdk-fbsvc-199a6f73a4.json"
npm run seed:firestore
```

Esto crea `configuracion/encuesta_actual` y `configuracion/esquema_respuestas`. Las respuestas se guardan en `encuestas_satisfaccion`.

## Base de clientes

La colección `clientes` se carga desde `Cliente.xlsx` (columnas `Codigo`, `Nombre`, `Cedula`, `Vendedor`):

```powershell
npm run seed:clientes -- --dry-run   # solo reporta lo que se cargaría
$env:GOOGLE_APPLICATION_CREDENTIALS = ".\encuesta-satisfaccion-5210f-firebase-adminsdk-fbsvc-199a6f73a4.json"
npm run seed:clientes
```

- El ID de cada documento es la cédula **normalizada**: sin espacios, guiones ni puntos y en mayúsculas. La aplicación normaliza igual lo que escribe el cliente, así que `3-101-054071` y `3101054071` llegan a la misma ficha.
- La carga usa `merge`, así que volver a correrla actualiza los datos existentes y agrega los nuevos. **No borra** los clientes que ya no estén en el Excel; para eso hay que eliminarlos a mano en Firestore.
- Las filas sin cédula, sin nombre o sin vendedor se omiten y se reportan al final; las cédulas repetidas conservan la primera fila.
- Para cargar otro archivo: `npm run seed:clientes -- ruta\\al\\archivo.xlsx`.
- `Cliente.xlsx` **no se versiona** (está en `.gitignore`) porque contiene datos personales de los clientes. Hay que tenerlo en la raíz del proyecto para poder correr la carga.

## Flujo de la encuesta

1. **Identificación**: la persona escribe la cédula con la que factura. La aplicación busca esa ficha en `clientes` y muestra el nombre del cliente y su vendedor asignado; el botón *Continuar* permanece bloqueado hasta que haya coincidencia. Ni el nombre ni el vendedor se escriben a mano.
2. **Tres secciones de preguntas** (Producto, Precio y Servicio) con las 12 preguntas completas. Cada pregunta se califica de forma cualitativa: *Malo, Regular, Bueno, Muy bueno, Excelente*. No se usan números en ninguna parte, ni en la pantalla ni en la base de datos.
3. **Cierre**: comentario opcional y consentimiento.
4. **Código de participación**: cada envío genera un código único (`EB-XXXXXXXX`) que se muestra con un botón para copiarlo. Un mismo cliente puede responder varias veces (distintos departamentos o personas) y cada respuesta recibe su propio código, que es el que identifica a la persona ganadora de la rifa.

## Netlify

- Build command: `npm run build`
- Publish directory: `dist`
- Agrega en Netlify las seis variables `VITE_FIREBASE_*` de `.env.example`.

Las reglas versionadas están en `firestore.rules`. Para publicarlas, la cuenta usada debe tener el rol IAM `Firebase Rules Admin` (`roles/firebaserules.admin`) y luego se puede ejecutar `npm run deploy:firestore-rules`. La cuenta Admin no debe subirse al repositorio ni configurarse como variable `VITE_*`.

Las reglas controlan lo siguiente:

- `clientes`: se puede leer **una** ficha si se conoce la cédula exacta (`get`), pero listar la colección completa requiere cuenta autenticada. Nadie puede escribirla desde la web; solo el script con el SDK Admin.
- `encuestas_satisfaccion`: al crear una respuesta, las reglas consultan la ficha del cliente y exigen que el nombre y el vendedor coincidan con lo que está en `clientes`, que las 12 respuestas estén completas y dentro de la escala, y que el código tenga el formato esperado. No se permite modificar ni borrar respuestas.

Cada vez que cambien las preguntas, la escala o los campos guardados, hay que volver a publicar las reglas.

## Panel administrativo

El panel está disponible en `/admin`. Habilita el proveedor **Email/Password** en Firebase Authentication y crea allí las cuentas autorizadas. Después de iniciar sesión, cada usuario autenticado puede consultar las respuestas de `encuestas_satisfaccion` con su código, cédula, cliente y vendedor; el público no puede leerlas.
