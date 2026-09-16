"use client";
import { ChatbotDashboard } from "@/components/ChatBotAlpha/dashboard/ChatbotDashboard";
import { useChatbotStore } from "@/store/useChatbotStore";
export default function ChatbotDashboardPage() { const data = useChatbotStore((state) => state.snapshot.dashboard); return <ChatbotDashboard data={data} />; }
