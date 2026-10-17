-- Vina iz kolekcije. ID mora odgovarati nazivu na kartici (bez dijakritike, malim slovima, crticama) – to već jest tako.
-- CIJENE: upišite ih ovdje (zamijenite null iznosom, npr. 12.50) ILI poslije u administratorskom panelu (kartica "Cijene vina").
insert into public.products (id, name, price, sort_order) values
  ('grasevina', 'Graševina', null, 1),
  ('kumovo-pinot-sivi', 'Kumovo Pinot Sivi', null, 2),
  ('dolce-aurea', 'Dolce Aurea', null, 3),
  ('grasevina-academia', 'Graševina Academia', null, 4),
  ('sauvignon', 'Sauvignon', null, 5),
  ('rudina', 'Rudina', null, 6),
  ('merlot', 'Merlot', null, 7),
  ('cabernet-sauvignon', 'Cabernet Sauvignon', null, 8),
  ('pinot-crni', 'Pinot Crni', null, 9),
  ('syrah', 'Syrah', null, 10),
  ('muskat-zuti', 'Muškat Žuti', null, 11),
  ('chardonnay-izborna-berba-prosusenih-bobica', 'Chardonnay Izborna Berba Prosušenih Bobica', null, 12),
  ('pinot-crni-izborna-berba', 'Pinot Crni Izborna Berba', null, 13),
  ('grasevina-ledeno-vino', 'Graševina Ledeno Vino', null, 14)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Primjer postavljanja cijena (decimalna točka, ne zarez):
-- update public.products set price = 9.50  where id = 'grasevina';
-- update public.products set price = 12.00 where id = 'merlot';
