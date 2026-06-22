const SUPABASE_URL = "https://yqaabswcvwkiimpoxsfj.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYWFic3djdndraWltcG94c2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NDMwMzEsImV4cCI6MjA5NzExOTAzMX0.lp-MqwLJiiHyMyITkQ59BoNvKWHtHl14FevIa3PtnF4";

window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: {
      getItem: (key) => {
        const remember = localStorage.getItem("rememberLogin") !== "false";
        return (remember ? localStorage : sessionStorage).getItem(key);
      },
      setItem: (key, value) => {
        const remember = localStorage.getItem("rememberLogin") !== "false";
        (remember ? localStorage : sessionStorage).setItem(key, value);
      },
      removeItem: (key) => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      },
    },
    persistSession: true,
    autoRefreshToken: true,
  },
});

async function getProfile(userId) {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return data;
}

async function upsertProfile(userId, data) {
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, ...data })
    .select()
    .single();
  if (error) throw error;
}

async function updateProfile(userId, updates) {
  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId);
  if (error) throw error;
}

async function getAthletes() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, group_name, role, hr_zones, thresholds, garmin_url, strava_url, spreadsheet_url")
    .or(`role.eq.athlete,id.eq.${user.id}`)
    .order("full_name");
  return data || [];
}

async function getAllProfiles() {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name");
  return data || [];
}

async function getPlans(athleteId, weekStart, weekEnd) {
  const { data } = await supabase
    .from("plans")
    .select("*")
    .eq("athlete_id", athleteId)
    .gte("date", weekStart)
    .lte("date", weekEnd)
    .order("date");
  return data || [];
}

async function insertPlan(plan) {
  const { data, error } = await supabase
    .from("plans")
    .insert(plan)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updatePlan(id, updates) {
  const { error } = await supabase
    .from("plans")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

async function deletePlan(id) {
  const { error } = await supabase
    .from("plans")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

async function getTemplates(athleteId) {
  let query = supabase.from("templates").select("*");
  if (athleteId) {
    query = query.or(`athlete_id.is.null,athlete_id.eq.${athleteId}`);
  }
  const { data } = await query.order("name");
  return data || [];
}

async function insertTemplate(template) {
  const { data, error } = await supabase
    .from("templates")
    .insert(template)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteTemplate(id) {
  const { error } = await supabase
    .from("templates")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

async function updateTemplate(id, updates) {
  const { data, error } = await supabase
    .from("templates")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getRaces(athleteId) {
  const { data } = await supabase
    .from("races")
    .select("*")
    .eq("athlete_id", athleteId)
    .order("date", { ascending: true });
  return data || [];
}

async function getRacesForWeek(athleteId, weekStart, weekEnd) {
  const { data } = await supabase
    .from("races")
    .select("*")
    .eq("athlete_id", athleteId)
    .gte("date", weekStart)
    .lte("date", weekEnd)
    .order("date");
  return data || [];
}

async function insertRace(race) {
  const { data, error } = await supabase
    .from("races")
    .insert(race)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateRace(id, updates) {
  const { data, error } = await supabase
    .from("races")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteRace(id) {
  const { error } = await supabase
    .from("races")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

async function getRecords(athleteId) {
  const { data } = await supabase
    .from("records")
    .select("*")
    .eq("athlete_id", athleteId)
    .order("distance");
  return data || [];
}

async function insertRecord(record) {
  const { data, error } = await supabase
    .from("records")
    .insert(record)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateRecord(id, updates) {
  const { error } = await supabase
    .from("records")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

async function deleteRecord(id) {
  const { error } = await supabase
    .from("records")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

async function getLogEntries(athleteId, weekStart, weekEnd) {
  const { data } = await supabase
    .from("log_entries")
    .select("*")
    .eq("athlete_id", athleteId)
    .gte("date", weekStart)
    .lte("date", weekEnd)
    .order("date");
  return data || [];
}

async function getWeeklyStats(athleteId, weekStart, weekEnd) {
  const { data } = await supabase
    .from("log_entries")
    .select("activity_type, distance_km, duration_min")
    .eq("athlete_id", athleteId)
    .gte("date", weekStart)
    .lte("date", weekEnd);

  if (!data) return { run: { km: 0, min: 0 }, gym: { min: 0 }, bike: { min: 0 } };

  const stats = { run: { km: 0, min: 0 }, gym: { min: 0 }, bike: { min: 0 } };
  for (const entry of data) {
    if (entry.activity_type === "run") {
      stats.run.km += Number(entry.distance_km) || 0;
      stats.run.min += Number(entry.duration_min) || 0;
    } else if (entry.activity_type === "gym") {
      stats.gym.min += Number(entry.duration_min) || 0;
    } else if (entry.activity_type === "bike") {
      stats.bike.min += Number(entry.duration_min) || 0;
    }
  }
  return stats;
}

async function getMonthlyRunKm(athleteId, monthStart, monthEnd) {
  const { data } = await supabase
    .from("log_entries")
    .select("distance_km")
    .eq("athlete_id", athleteId)
    .eq("activity_type", "run")
    .gte("date", monthStart)
    .lte("date", monthEnd);

  if (!data) return 0;
  return data.reduce((sum, e) => sum + (Number(e.distance_km) || 0), 0);
}

async function getMonthlyRunDuration(athleteId, monthStart, monthEnd) {
  const { data } = await supabase
    .from("log_entries")
    .select("duration_min")
    .eq("athlete_id", athleteId)
    .eq("activity_type", "run")
    .gte("date", monthStart)
    .lte("date", monthEnd);

  if (!data) return 0;
  return data.reduce((sum, e) => sum + (Number(e.duration_min) || 0), 0);
}

function trendDateISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function trendMonday(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

function trendMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

async function getWeeklyTrend(athleteId, numWeeks) {
  const endDate = trendMonday(new Date());
  endDate.setDate(endDate.getDate() + 6);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (numWeeks * 7) + 1);

  const startStr = trendDateISO(startDate);
  const endStr = trendDateISO(endDate);

  const { data: logs } = await supabase
    .from("log_entries")
    .select("date, activity_type, distance_km, duration_min")
    .eq("athlete_id", athleteId)
    .gte("date", startStr)
    .lte("date", endStr);

  const { data: plansData } = await supabase
    .from("plans")
    .select("date, title")
    .eq("athlete_id", athleteId)
    .gte("date", startStr)
    .lte("date", endStr);

  const vfsSfsDates = new Set();
  if (plansData) {
    for (const p of plansData) {
      const t = (p.title || "").toLowerCase();
      if (t === "vfs" || t === "sfs") vfsSfsDates.add(p.date);
    }
  }

  const weeks = {};
  for (let i = 0; i < numWeeks; i++) {
    const m = new Date(startDate);
    m.setDate(m.getDate() + i * 7);
    const mon = trendMonday(m);
    const key = trendDateISO(mon);
    weeks[key] = { week_start: key, run_km: 0, run_min: 0, vfs_sfs_min: 0, velo_min: 0 };
  }

  if (logs) {
    for (const entry of logs) {
      const d = new Date(entry.date + "T00:00:00");
      const mon = trendMonday(d);
      const key = trendDateISO(mon);
      if (!weeks[key]) continue;
      if (entry.activity_type === "run") {
        weeks[key].run_km += Number(entry.distance_km) || 0;
        weeks[key].run_min += Number(entry.duration_min) || 0;
        if (vfsSfsDates.has(entry.date)) {
          weeks[key].vfs_sfs_min += Number(entry.duration_min) || 0;
        }
      } else if (entry.activity_type === "bike") {
        weeks[key].velo_min += Number(entry.duration_min) || 0;
      }
    }
  }

  return Object.values(weeks);
}

async function getMonthlyTrend(athleteId, numMonths) {
  const endDate = new Date();
  const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - numMonths + 1, 1);

  const startStr = trendDateISO(startDate);
  const endStr = trendDateISO(endDate);

  const { data: logs } = await supabase
    .from("log_entries")
    .select("date, activity_type, distance_km, duration_min")
    .eq("athlete_id", athleteId)
    .gte("date", startStr)
    .lte("date", endStr);

  const { data: plansData } = await supabase
    .from("plans")
    .select("date, title")
    .eq("athlete_id", athleteId)
    .gte("date", startStr)
    .lte("date", endStr);

  const vfsSfsDates = new Set();
  if (plansData) {
    for (const p of plansData) {
      const t = (p.title || "").toLowerCase();
      if (t === "vfs" || t === "sfs") vfsSfsDates.add(p.date);
    }
  }

  const months = {};
  for (let i = 0; i < numMonths; i++) {
    const m = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
    const key = trendDateISO(m);
    months[key] = { month_start: key, run_km: 0, run_min: 0, vfs_sfs_min: 0, velo_min: 0 };
  }

  if (logs) {
    for (const entry of logs) {
      const d = new Date(entry.date + "T00:00:00");
      const ms = trendDateISO(trendMonthStart(d));
      if (!months[ms]) continue;
      if (entry.activity_type === "run") {
        months[ms].run_km += Number(entry.distance_km) || 0;
        months[ms].run_min += Number(entry.duration_min) || 0;
        if (vfsSfsDates.has(entry.date)) {
          months[ms].vfs_sfs_min += Number(entry.duration_min) || 0;
        }
      } else if (entry.activity_type === "bike") {
        months[ms].velo_min += Number(entry.duration_min) || 0;
      }
    }
  }

  return Object.values(months);
}

async function insertLogEntry(entry) {
  const { data, error } = await supabase
    .from("log_entries")
    .insert(entry)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteLogEntry(id) {
  const { error } = await supabase
    .from("log_entries")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

async function updateLogEntry(id, updates) {
  const { data, error } = await supabase
    .from("log_entries")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getWeeklySummary(athleteId, weekStart) {
  const { data } = await supabase
    .from("weekly_summaries")
    .select("*")
    .eq("athlete_id", athleteId)
    .eq("week_start", weekStart)
    .maybeSingle();
  return data || null;
}

async function upsertWeeklySummary(data) {
  const { error } = await supabase
    .from("weekly_summaries")
    .upsert(data, { onConflict: "athlete_id,week_start" })
    .select()
    .single();
  if (error) throw error;
}

async function getDayNotes(athleteId, weekStart, weekEnd) {
  const { data } = await supabase
    .from("day_notes")
    .select("*")
    .eq("athlete_id", athleteId)
    .gte("date", weekStart)
    .lte("date", weekEnd);
  return data || [];
}

async function getDayNote(athleteId, date) {
  const { data } = await supabase
    .from("day_notes")
    .select("*")
    .eq("athlete_id", athleteId)
    .eq("date", date)
    .maybeSingle();
  return data || null;
}

async function upsertDayNote(data) {
  const { error } = await supabase
    .from("day_notes")
    .upsert(data, { onConflict: "athlete_id,date" })
    .select()
    .single();
  if (error) throw error;
}

async function getRestrictions(athleteId) {
  const { data } = await supabase
    .from("restrictions")
    .select("*")
    .eq("athlete_id", athleteId)
    .order("start_date");
  return data || [];
}

async function insertRestriction(r) {
  const { data, error } = await supabase
    .from("restrictions")
    .insert(r)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteRestriction(id) {
  const { error } = await supabase
    .from("restrictions")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

async function getDiaryEntries(athleteId) {
  const { data } = await supabase
    .from("diary_entries")
    .select("*")
    .eq("athlete_id", athleteId)
    .order("date", { ascending: false });
  return data || [];
}

async function insertDiaryEntry(data) {
  const { data: result, error } = await supabase
    .from("diary_entries")
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return result;
}

async function updateDiaryEntry(id, updates) {
  const { error } = await supabase
    .from("diary_entries")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

async function deleteDiaryEntry(id) {
  const { error } = await supabase
    .from("diary_entries")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
