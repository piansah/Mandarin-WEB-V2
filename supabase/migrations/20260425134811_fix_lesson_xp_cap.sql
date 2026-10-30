
CREATE OR REPLACE FUNCTION public.get_user_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
declare
  v_user_id uuid;
  v_xp integer := 0;
  v_rank integer := 1;
  v_akurasi integer := 0;
  v_sesi_count integer := 0;
  v_kosakata_count integer := 0;
  v_quiz_total integer := 0;
  v_quiz_sum integer := 0;
  r record;
  other record;
  other_xp integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    return json_build_object('error', 'Unauthorized');
  end if;

  for r in
    select type, score
    from public.user_scores
    where user_id = v_user_id
      and type <> 'nada_word'
  loop
    v_sesi_count := v_sesi_count + 1;

    if r.type in ('quiz', 'kal', 'grammar') then
      if r.score >= 80 then
        v_xp := v_xp + 36;
      elsif r.score >= 60 then
        v_xp := v_xp + 18;
      else
        v_xp := v_xp + 9;
      end if;

      if r.type = 'quiz' then
        v_quiz_total := v_quiz_total + 1;
        v_quiz_sum := v_quiz_sum + coalesce(r.score, 0);
      end if;

    elsif r.type = 'hanzi' and r.score >= 100 then
      v_xp := v_xp + 36;

    elsif r.type = 'tulis_session' and r.score >= 100 then
      v_xp := v_xp + 36;

    elsif r.type = 'cerita' and r.score >= 95 then
      v_xp := v_xp + 36;

    elsif r.type in ('fc_session', 'nada_session', 'speaking_session') then
      v_xp := v_xp + least(coalesce(r.score, 0), 36);

    elsif r.type = 'cerita_quiz' then
      if r.score >= 80 then
        v_xp := v_xp + 20;
      elsif r.score >= 60 then
        v_xp := v_xp + 12;
      else
        v_xp := v_xp + 6;
      end if;

    elsif r.type = 'lesson' then
      v_xp := v_xp + coalesce(r.score, 0);
    end if;
  end loop;

  if v_quiz_total > 0 then
    v_akurasi := round(v_quiz_sum::numeric / v_quiz_total);
  end if;

  for other in
    select distinct user_id
    from public.user_scores
    where user_id <> v_user_id
  loop
    other_xp := 0;

    for r in
      select type, score
      from public.user_scores
      where user_id = other.user_id
        and type <> 'nada_word'
    loop
      if r.type in ('quiz', 'kal', 'grammar') then
        if r.score >= 80 then
          other_xp := other_xp + 36;
        elsif r.score >= 60 then
          other_xp := other_xp + 18;
        else
          other_xp := other_xp + 9;
        end if;

      elsif r.type = 'hanzi' and r.score >= 100 then
        other_xp := other_xp + 36;

      elsif r.type = 'tulis_session' and r.score >= 100 then
        other_xp := other_xp + 36;

      elsif r.type = 'cerita' and r.score >= 95 then
        other_xp := other_xp + 36;

      elsif r.type in ('fc_session', 'nada_session', 'speaking_session') then
        other_xp := other_xp + least(coalesce(r.score, 0), 36);

      elsif r.type = 'cerita_quiz' then
        if r.score >= 80 then
          other_xp := other_xp + 20;
        elsif r.score >= 60 then
          other_xp := other_xp + 12;
        else
          other_xp := other_xp + 6;
        end if;

      elsif r.type = 'lesson' then
        other_xp := other_xp + coalesce(r.score, 0);
      end if;
    end loop;

    if other_xp > v_xp then
      v_rank := v_rank + 1;
    end if;
  end loop;

  select count(*)
  into v_kosakata_count
  from public.user_card_progress
  where user_id = v_user_id;

  return json_build_object(
    'xp', v_xp,
    'rank', v_rank,
    'akurasi', v_akurasi,
    'sesiCount', v_sesi_count,
    'kosakataCount', v_kosakata_count
  );
end;
$$;
;
