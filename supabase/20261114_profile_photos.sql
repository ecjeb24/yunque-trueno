-- Persist each Gymbro profile picture across browsers and show it to staff.
alter table public.gym_profiles
  add column if not exists profile_photo text not null default '';

grant update(profile_photo) on public.gym_profiles to authenticated;
