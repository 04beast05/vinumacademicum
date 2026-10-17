-- Vina iz kolekcije. ID mora odgovarati nazivu na kartici (bez dijakritike, malim slovima, crticama) – to već jest tako.
-- CIJENE: upišite ih ovdje (zamijenite null iznosom, npr. 12.50) ILI poslije u administratorskom panelu (kartica "Cijene vina").
insert into public.products (id, name, price, sort_order) values
  ('grasevina', 'Graševina', 6.80, 1),
  ('kumovo-pinot-sivi', 'Kumovo Pinot Sivi', 4.00, 2),
  ('dolce-aurea', 'Dolce Aurea', 6.00, 3),
  ('grasevina-academia', 'Graševina Academia', 6.80, 4),
  ('sauvignon', 'Sauvignon', 6.00, 5),
  ('rudina', 'Rudina', 3.90, 6),
  ('merlot', 'Merlot', 5.50, 7),
  ('cabernet-sauvignon', 'Cabernet Sauvignon', 6.50, 8),
  ('pinot-crni', 'Pinot Crni', 5.50, 9),
  ('syrah', 'Syrah', 5.50, 10),
  ('muskat-zuti', 'Muškat Žuti', 6.00, 11),
  ('chardonnay-izborna-berba-prosusenih-bobica', 'Chardonnay Izborna Berba Prosušenih Bobica', 26.00, 12),
  ('pinot-crni-izborna-berba', 'Pinot Crni Izborna Berba', 9.80, 13),
  ('grasevina-ledeno-vino', 'Graševina Ledeno Vino', 29.00, 14)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Primjer postavljanja cijena (decimalna točka, ne zarez):
-- update public.products set price = 9.50  where id = 'grasevina';
-- update public.products set price = 12.00 where id = 'merlot';
