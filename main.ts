import { Application } from "https://deno.land/x/oak/mod.ts";
import createFileEditor from './fileEditor.ts';

const app = new Application();

const fileRouter = await createFileEditor(Deno.env.get('FILE_EDITOR_FILE') ?? Deno.args[0] ?? 'data.txt', Deno.env.get('FILE_EDITOR_TITLE') ?? 'Data Dump', Deno.env.get('FILE_EDITOR_PASS') ?? null);

app.use(fileRouter.routes())
app.use(fileRouter.allowedMethods())

app.listen({port: +(Deno.env.get('FILE_EDITOR_PORT') ?? 8000), hostname: Deno.env.get('FILE_EDITOR_HOST') ?? 'localhost'})

console.log('Listening');
