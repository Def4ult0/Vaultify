// supabase.js

if (!window.supabase) {
    console.error("Supabase not loaded ❌");
} else {
    const supabaseUrl = "https://vmbbrbhfeitlhpjlsjzn.supabase.co";
    const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtYmJyYmhmZWl0bGhwamxzanpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNTkwNTQsImV4cCI6MjA4OTkzNTA1NH0.b4gsM7w2_zE6CZDGKyzEGpE0Fmq_Lx5qjoFByEnvVyc";
    
    window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
    console.log("Supabase ready ✅");
}