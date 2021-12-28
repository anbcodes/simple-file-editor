import { Router } from "https://deno.land/x/oak/mod.ts";
import { ensureFile } from "https://deno.land/std/fs/ensure_file.ts";

const htmlString = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{NAME}}</title>
    <style>
      textarea {
        padding: 10px;
        width: 100vw;
        height: 100vh;
        line-height: 1.5;
        font-family: monospace;
        outline: none;
        overflow: scroll;
        border: none;
      }
      html, body {
        min-height: 100vh;
        padding: 0px;
        margin: 0px;
        overflow: hidden;
      }
      textarea:focus {
        outline: none;
      }
    </style>
</head>
<body>
    <textarea id="text"></textarea>
    <script>
        const ws = new WebSocket('ws://' + window.location.hostname + ':' + window.location.port + '/ws');
        function login() {
          //{{IFPASS
          const pass = localStorage.getItem('password') || prompt('Password: ');
          ws.send(JSON.stringify({type: 'auth', password: pass}))
          localStorage.setItem('password', pass)
          //ENDIF}}
        }

        ws.addEventListener('open', (ev) => {
          login()
        })

        let prev = '';
        
        ws.addEventListener('message', function (ev) {
          const data = JSON.parse(ev.data)
          if (data.file) {
            const text = document.getElementById('text');
            const sStart = text.selectionStart;
            const sEnd = text.selectionEnd;
            const sDirection = text.selectionDirection;
            text.value = data.file;
            prev = data.file;
            text.selectionStart = sStart;
            text.selectionEnd = sEnd;
            text.selectionDirection = sDirection;  
            console.log(sStart, sEnd, sDirection, text.selectionStart, text.selectionEnd)
          }

          if (data.type === 'authFailed') {
            alert('wrong password');
            localStorage.removeItem('password')
            login()
          }
        })
        const inputEl = document.getElementById('text')
        inputEl.addEventListener('input', function(ev) {
            ws.send(JSON.stringify({
              type: 'write',
              file: inputEl.value,
              password: localStorage.getItem('password')
            }));
            prev = inputEl.value;
        });
    </script>
</body>
</html>
`;

export default async function createFileEditor(
  path: string,
  title = "File Editor",
  password: string | null = null,
) {
  let html = htmlString.replace(/{{NAME}}/, title);

  if (password === null) {
    html = html.replace(/{{IFPASS([^]*)ENDIF}}/, "");
  }
  await ensureFile(path);
  let fileString = await Deno.readTextFile(path);
  const authClients: WebSocket[] = [];
  const router = new Router();

  router
    .get("/ws", (ctx) => {
      const ws = ctx.upgrade();
      ws.addEventListener("message", (ev) => {
        if (ev.data !== null) {
          const data = JSON.parse(ev.data);
          if (data.type === "write" && data.password === password) {
            fileString = data.file;
            Deno.writeTextFileSync(path, fileString);
            authClients.filter((v) => v !== ws && v.readyState === WebSocket.OPEN).forEach((v) =>
              v.send(JSON.stringify({
                type: "file",
                file: fileString,
              }))
            );
          } else if (data.type === "auth") {
            if (data.password === password) {
              authClients.push(ws);
              ws.send(JSON.stringify({
                type: "authSuccess",
                file: fileString,
              }));
              ws.addEventListener(
                "close",
                () => authClients.filter((v) => v !== ws),
              );
            } else {
              ws.send(JSON.stringify({
                type: "authFailed",
              }));
            }
          }
        }
      });
    })
    .get("/", (ctx) => {
      ctx.response.body = html;
    });

  return router;
}
