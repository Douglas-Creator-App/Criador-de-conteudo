insert into public.content_projects (name, niche)
values ('Default Content Project', 'Definir nicho')
on conflict do nothing;

