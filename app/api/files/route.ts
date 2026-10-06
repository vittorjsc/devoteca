import {ApiError,database,bucket,identity,fail,textValue,bodyBytes} from '@/lib/library';
export async function GET(req:Request){try{await identity(req);const id=textValue(new URL(req.url).searchParams.get('id'),100,true);const r=await database().prepare('SELECT file_key,file_name FROM resources WHERE id=?').bind(id).first<{file_key:string,file_name:string}>();if(!r?.file_key)throw new ApiError('Arquivo não encontrado.',404);const o=await bucket().get(r.file_key);if(!o)throw new ApiError('Arquivo indisponível.',404);return new Response(o.body,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(r.file_name)}`,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'; sandbox"}});}catch(e){return fail(e);}}
import {saveResource} from '@/app/api/library/route';
export async function PUT(req:Request){try{
 await identity(req);
 let metadata:Record<string,unknown>;
 try{const raw=req.headers.get('X-Devoteca-Metadata')||'';if(raw.length>24576)throw 0;metadata=JSON.parse(decodeURIComponent(raw));if(!metadata||Array.isArray(metadata)||typeof metadata!=='object')throw 0;}catch{throw new ApiError('Dados do arquivo inválidos.');}
 const name=textValue(metadata.fileName,180,true),type=textValue(metadata.fileType,100)||'application/octet-stream';
 if(!req.body)throw new ApiError('Selecione um arquivo.');
 const bytes=await bodyBytes(req,20*1024*1024);
 if(!bytes.length)throw new ApiError('O arquivo está vazio.');
 const form=new FormData();for(const field of ['id','title','description','url','type','category','tags'])if(typeof metadata[field]==='string')form.set(field,metadata[field] as string);
 form.set('file',new File([bytes],name,{type}));
 return saveResource(req,form);
}catch(e){return fail(e);}}
