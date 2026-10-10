alter table sentence_meanings add column if not exists part_of_speech varchar(20);
alter table sentence_meanings add column if not exists form varchar(40);
alter table sentence_meanings add column if not exists lemma varchar(40);
