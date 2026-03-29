const knowledgeBase = [
  {
    keywords: ["admission", "apply", "application"],
    reply:
      "Applications are open for the 2026-2027 intake. Start with program selection, upload academic records, and complete document verification before the interview slot is assigned."
  },
  {
    keywords: ["course", "program", "degree"],
    reply:
      "The platform currently highlights engineering, commerce, humanities, health sciences, and interdisciplinary programs. Share the stream you are interested in and we can guide you to the right campus."
  },
  {
    keywords: ["contact", "phone", "email", "office"],
    reply:
      "You can reach the admissions desk through the Contact section on the homepage. For urgent support, the central helpdesk responds to phone, email, and campus visit requests."
  },
  {
    keywords: ["fee", "fees", "scholarship"],
    reply:
      "Fee structures vary by program and campus. Merit scholarships, need-based aid, and category-based support are available after eligibility review."
  },
  {
    keywords: ["campus", "hostel", "location"],
    reply:
      "Each campus has its own academic profile, facilities, and student support services. Ask about a city or program area and we will narrow down the best match."
  }
];

export function getPublicAssistantReply(message: string) {
  const normalized = message.toLowerCase();
  const match = knowledgeBase.find((entry) => entry.keywords.some((keyword) => normalized.includes(keyword)));

  return match?.reply
    ?? "I can help with admissions, courses, campuses, scholarships, and contact details. Ask a more specific question and I will guide you.";
}
