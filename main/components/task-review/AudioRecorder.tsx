"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Play, Square, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useUploadAudio } from "@/lib/hooks/useTaskReview";

interface AudioRecorderProps {
  url?: string;
  duration?: number;
  taskId?: string;
  onAudioSaved: (url: string, duration: number) => void;
  disabled?: boolean;
}

export function AudioRecorder({
  url,
  duration,
  taskId,
  onAudioSaved,
  disabled,
}: AudioRecorderProps) {
  const t = useTranslations("TaskReview");
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const uploadMutation = useUploadAudio();

  const startRecording = useCallback(async () => {
    if (disabled) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const durationSecs = recordingTime;

        // Upload
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
        const fileName = `${dateStr}_${taskId || "web"}_${Date.now()}.webm`;

        const formData = new FormData();
        formData.append("file", blob, fileName);
        formData.append("fileName", fileName);

        try {
          const result = await uploadMutation.mutateAsync(formData);
          if (result.url) {
            onAudioSaved(result.url, durationSecs);
          }
        } catch {
          // Error handled by mutation
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch {
      // Permission denied or not supported
    }
  }, [disabled, taskId, onAudioSaved, uploadMutation, recordingTime]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  const playAudio = useCallback(() => {
    if (!url) return;
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      return;
    }

    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => setIsPlaying(false);
    audio.play();
    setIsPlaying(true);
  }, [url, isPlaying]);

  const isUploading = uploadMutation.isPending;

  if (disabled && url) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={playAudio}>
          {isPlaying ? <Square className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
          {t("tapToPlay")}
          {duration ? ` (${duration}s)` : ""}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {url && (
        <Button variant="outline" size="sm" onClick={playAudio} disabled={isRecording}>
          {isPlaying ? <Square className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
          {duration ? `${duration}s` : t("tapToPlay")}
        </Button>
      )}

      {isUploading ? (
        <Button variant="outline" size="sm" disabled>
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          {t("uploading")}
        </Button>
      ) : isRecording ? (
        <Button
          variant="destructive"
          size="sm"
          onClick={stopRecording}
        >
          <Square className="w-3 h-3 mr-1" />
          {t("clickToStop")} ({recordingTime}s)
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={startRecording}
          disabled={disabled}
        >
          <Mic className="w-3 h-3 mr-1" />
          {t("clickToRecord")}
        </Button>
      )}
    </div>
  );
}
