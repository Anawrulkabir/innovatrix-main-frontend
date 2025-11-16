"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo } from "react";
import { createSupabaseClientSide } from "@/lib/supabase/supabase-client-side";
import { useRouter, useParams } from "next/navigation";

interface Job {
  id: number;
  job_title: string;
  company: string;
  location: string;
  required_skills: string[];
  experience_level: "Intern" | "Entry" | "Mid" | "Senior" | string;
  job_type: "Internship" | "Part-time" | "Full-time" | "Freelance" | string;
  description: string | null;
  created_at: string;
}

interface MatchResult {
  missing_skill: string[];
  overlap_skill: string[];
  should_apply: boolean;
  similarity_score: number;
  justification: string;
}

interface UserProfile {
  resumecontext: string | null;
  preferred_career_track: string | null;
  experience_level: string | null;
}

export default function JobDetailsPage() {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const params = useParams();
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseClientSide(), []);

  useEffect(() => {
    const fetchJob = async () => {
      if (!params.id) return;

      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from("jobs")
          .select("*")
          .eq("id", params.id)
          .single();

        if (fetchError) {
          throw fetchError;
        }

        setJob(data);
      } catch (err: unknown) {
        const error = err as Error;
        setError(error.message || "Failed to fetch job details");
        console.error("Error fetching job:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [params.id, supabase]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        const { data, error: profileError } = await supabase
          .from("job_seekers")
          .select("resumecontext, preferred_career_track, experience_level")
          .eq("id", session.user.id)
          .single();

        if (!profileError && data) {
          setUserProfile({
            resumecontext: data.resumecontext,
            preferred_career_track: data.preferred_career_track,
            experience_level: data.experience_level,
          });
        }
      } catch (err) {
        console.error("Error fetching user profile:", err);
      }
    };

    fetchUserProfile();
  }, [supabase]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const mapExperienceLevel = (level: string): "Fresher" | "Junior" | "Mid" | "Senior" => {
    const levelLower = level.toLowerCase();
    if (levelLower.includes("intern") || levelLower.includes("fresher") || levelLower.includes("entry")) {
      return "Fresher";
    }
    if (levelLower.includes("junior")) {
      return "Junior";
    }
    if (levelLower.includes("senior")) {
      return "Senior";
    }
    return "Mid";
  };

  const handleMatchAnalysis = async () => {
    if (!job || !userProfile?.resumecontext) {
      setMatchError("Please complete your profile and upload your resume to use this feature.");
      return;
    }

    setIsMatching(true);
    setMatchError(null);
    setMatchResult(null);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_MAIN_BACKEND_SERVICE_URL;
      if (!backendUrl) {
        throw new Error("Backend service URL is not configured");
      }

      const requestBody = {
        resume_context: userProfile.resumecontext,
        preferred_track: userProfile.preferred_career_track || "",
        experience_level: mapExperienceLevel(userProfile.experience_level || "Fresher"),
        job_title: job.job_title,
        company: job.company,
        locations: [job.location],
        required_skills: job.required_skills || [],
        job_experience_level: mapExperienceLevel(job.experience_level),
        job_type: job.job_type,
      };

      const response = await fetch(`${backendUrl}/api/match-job-resume`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to analyze job match");
      }

      const data = await response.json();
      setMatchResult(data);
    } catch (err: unknown) {
      const error = err as Error;
      console.error("Error matching job:", err);
      setMatchError(error.message || "Failed to analyze job match. Please try again.");
    } finally {
      setIsMatching(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return "bg-green-100 dark:bg-green-900/30";
    if (score >= 60) return "bg-yellow-100 dark:bg-yellow-900/30";
    return "bg-red-100 dark:bg-red-900/30";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-50">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-50">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <Card className="shadow-lg border-red-200 dark:border-red-800">
            <CardContent className="pt-6 text-center py-12">
              <div className="text-6xl mb-4">❌</div>
              <p className="text-lg text-destructive mb-2 font-semibold">
                {error || "Job not found"}
              </p>
              <Button
                onClick={() => router.push("/jobs")}
                className="mt-4"
              >
                Back to Jobs
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header with Back Button */}
        <div className="mb-4 flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white/80 backdrop-blur-sm hover:bg-emerald-50 hover:border-emerald-200 transition-all duration-300 text-xs"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium text-xs">Back to Jobs</span>
          </Button>
          <div className="h-6 w-px bg-slate-300"></div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-200 bg-emerald-100/80 text-xs font-semibold text-emerald-700">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Job Details
          </div>
        </div>

        {/* Main Job Card */}
        <Card className="shadow-xl border border-emerald-100 mb-4 bg-gradient-to-br from-white via-emerald-50/20 to-white rounded-lg overflow-hidden">
          <CardHeader className="pb-4 px-6 pt-6 bg-gradient-to-r from-emerald-50/30 to-transparent">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex-1">
                <CardTitle className="text-3xl mb-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 bg-clip-text text-transparent font-bold leading-tight">
                  {job.job_title}
                </CardTitle>
                <CardDescription className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <div className="w-6 h-6 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-md">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  {job.company}
                </CardDescription>
                <div className="flex flex-wrap gap-2 mt-4">
                  <span
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm ${
                      job.experience_level === "Intern"
                        ? "bg-gradient-to-r from-emerald-100 to-emerald-200 text-emerald-800 border border-emerald-300"
                        : job.experience_level === "Entry"
                        ? "bg-gradient-to-r from-emerald-100 to-emerald-200 text-emerald-800 border border-emerald-300"
                        : "bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-emerald-200/50"
                    }`}
                  >
                    {job.experience_level} Level
                  </span>
                  <span className="flex items-center gap-2 px-3 py-1.5 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg text-xs font-medium shadow-lg">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {job.location}
                  </span>
                  <span className="flex items-center gap-2 px-3 py-1.5 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg text-xs font-medium shadow-lg">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {job.job_type}
                  </span>
                  <span className="flex items-center gap-2 px-3 py-1.5 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg text-xs font-medium shadow-lg">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Posted {formatDate(job.created_at)}
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-6 py-6 space-y-6">
            {/* AI Match Analysis - Prominent Section */}
            <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100/30 border border-emerald-200 rounded-2xl p-6 shadow-lg shadow-emerald-100/30">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shadow-md">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 mb-1">
                        AI Job Match Analysis
                      </h3>
                      <p className="text-emerald-700 font-medium text-xs">
                        Get an instant AI-powered analysis of how well your profile matches this position
                      </p>
                    </div>
                  </div>
                  {!userProfile?.resumecontext && (
                    <div className="flex items-start gap-2 p-4 bg-amber-100/80 border border-amber-300 rounded-xl">
                      <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <p className="text-amber-800 font-medium text-xs">Resume Required</p>
                        <p className="text-amber-700 text-xs">Please upload your resume in your profile to use this feature.</p>
                      </div>
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleMatchAnalysis}
                  disabled={isMatching || !userProfile?.resumecontext}
                  className={`
                    px-6 py-3 rounded-lg font-semibold text-sm text-white transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg
                    ${
                      isMatching || !userProfile?.resumecontext
                        ? "bg-slate-400 cursor-not-allowed shadow-slate-200/50"
                        : "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:via-teal-700 hover:to-emerald-800 shadow-emerald-300/50 hover:shadow-emerald-400/60"
                    }
                  `}
                >
                  <div className="flex items-center gap-2">
                    {isMatching ? (
                      <>
                        <div className="w-4 h-4 border border-white/20 border-t-white rounded-full animate-spin" />
                        <span>Analyzing Match...</span>
                      </>
                    ) : (
                      <>
                        <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <span>Analyze Match</span>
                      </>
                    )}
                  </div>
                </Button>
              </div>
            </div>

            {/* Match Results Display */}
            {matchError && (
              <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-red-800 dark:text-red-300">{matchError}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {matchResult && (
              <Card className="border shadow-lg bg-gradient-to-br from-white to-blue-50/30 dark:from-slate-900 dark:to-slate-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Match Analysis Results
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Similarity Score */}
                  <div className="relative">
                    <div className={`rounded-lg p-4 ${getScoreBgColor(matchResult.similarity_score)} border border-current/20`}>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-foreground">Overall Match Score</h4>
                        <span className={`text-2xl font-bold ${getScoreColor(matchResult.similarity_score)}`}>
                          {matchResult.similarity_score.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-1000 ${
                            matchResult.similarity_score >= 80
                              ? "bg-gradient-to-r from-green-500 to-emerald-500"
                              : matchResult.similarity_score >= 60
                              ? "bg-gradient-to-r from-yellow-500 to-amber-500"
                              : "bg-gradient-to-r from-red-500 to-rose-500"
                          }`}
                          style={{ width: `${matchResult.similarity_score}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Justification */}
                  {matchResult.justification && (
                    <div className="rounded-xl p-5 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 border-2 border-blue-200 dark:border-blue-800">
                      <div className="flex items-start gap-3">
                        <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                          <h4 className="font-bold text-lg mb-2 text-blue-900 dark:text-blue-200">
                            Score Justification
                          </h4>
                          <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
                            {matchResult.justification}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Should Apply Recommendation */}
                  <div className={`rounded-lg p-4 border ${
                    matchResult.should_apply
                      ? "bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-700"
                      : "bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700"
                  }`}>
                    <div className="flex items-start gap-2">
                      {matchResult.should_apply ? (
                        <svg className="w-6 h-6 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      )}
                      <div className="flex-1">
                        <h4 className={`font-bold text-sm mb-1 ${
                          matchResult.should_apply
                            ? "text-green-800 dark:text-green-300"
                            : "text-amber-800 dark:text-amber-300"
                        }`}>
                          {matchResult.should_apply ? "✓ Recommended to Apply" : "⚠️ Consider Improving Your Profile"}
                        </h4>
                        <p className={`text-xs ${
                          matchResult.should_apply
                            ? "text-green-700 dark:text-green-400"
                            : "text-amber-700 dark:text-amber-400"
                        }`}>
                          {matchResult.should_apply
                            ? "Your profile shows a strong match with this position. We recommend applying!"
                            : "Your profile could benefit from some improvements before applying. Check the missing skills below."}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Overlap Skills */}
                  {matchResult.overlap_skill && matchResult.overlap_skill.length > 0 && (
                    <div>
                      <h4 className="text-lg font-bold mb-3 text-foreground flex items-center gap-2">
                        <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Matching Skills ({matchResult.overlap_skill.length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {matchResult.overlap_skill.map((skill, index) => (
                          <span
                            key={index}
                            className="px-4 py-2 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/40 text-green-800 dark:text-green-200 rounded-lg text-xs font-semibold border border-green-300 dark:border-green-700 shadow-sm"
                          >
                            ✓ {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Missing Skills */}
                  {matchResult.missing_skill && matchResult.missing_skill.length > 0 && (
                    <div>
                      <h4 className="text-lg font-bold mb-3 text-foreground flex items-center gap-2">
                        <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Missing Skills ({matchResult.missing_skill.length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {matchResult.missing_skill.map((skill, index) => (
                          <span
                            key={index}
                            className="px-4 py-2 bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/40 dark:to-orange-900/40 text-amber-800 dark:text-amber-200 rounded-lg text-xs font-semibold border border-amber-300 dark:border-amber-700 shadow-sm"
                          >
                            ⚠ {skill}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        💡 Consider learning these skills to improve your match score.
                      </p>
                    </div>
                  )}

                  {matchResult.overlap_skill.length === 0 && matchResult.missing_skill.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No skill analysis available for this job.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Description */}
            {job.description && (
              <div>
                <h3 className="text-xl font-bold mb-3 text-foreground">Job Description</h3>
                <div className="prose dark:prose-invert max-w-none">
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {job.description}
                  </p>
                </div>
              </div>
            )}

            {/* Required Skills */}
            {job.required_skills && job.required_skills.length > 0 && (
              <div>
                <h3 className="text-xl font-bold mb-4 text-foreground flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Required Skills
                </h3>
                <div className="flex flex-wrap gap-2">
                  {job.required_skills.map((skill, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/30 dark:via-indigo-900/30 dark:to-purple-900/30 text-blue-700 dark:text-blue-300 rounded-md text-xs font-semibold border border-blue-200 dark:border-blue-800 shadow-sm hover:shadow-md transition-shadow duration-200"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}


            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-6 border-t border-slate-200">
              <Button
                className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:via-teal-700 hover:to-emerald-800 text-white font-semibold text-sm py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </div>
                  <span>Apply Now</span>
                </div>
              </Button>
              <Button
                variant="outline"
                className="font-semibold text-sm py-3 border border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 transition-all duration-300 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <span>Save Job</span>
                </div>
              </Button>
              <Button
                variant="outline"
                className="font-semibold text-sm py-3 border border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 transition-all duration-300 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                  </svg>
                  <span>Share</span>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Additional Info Card */}
        <Card className="shadow-md border bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-1.5">
              <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              About This Position
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Experience Level
                </h4>
                <p className="text-muted-foreground">
                  {job.experience_level === "Intern" || job.experience_level?.toLowerCase().includes("intern")
                    ? "Perfect for students and recent graduates looking to gain industry experience."
                    : job.experience_level === "Entry" || job.experience_level?.toLowerCase().includes("entry") || job.experience_level?.toLowerCase().includes("fresher")
                    ? "Ideal for professionals with 0-2 years of experience in the field."
                    : job.experience_level?.toLowerCase().includes("senior")
                    ? "Suitable for professionals with 5+ years of relevant experience."
                    : "Suitable for professionals with 2-5 years of relevant experience."}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800">
                <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Job Type
                </h4>
                <p className="text-muted-foreground">
                  {job.job_type === "Full-time"
                    ? "Full-time position with standard working hours and benefits."
                    : job.job_type === "Part-time"
                    ? "Part-time position with flexible working hours."
                    : job.job_type === "Internship"
                    ? "Internship opportunity for learning and professional development."
                    : "Freelance project with flexible schedule and remote work options."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

