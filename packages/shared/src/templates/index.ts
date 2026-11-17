// 세션 양식 목록이에요. 새 양식은 JSON 파일을 추가하고 여기에 한 줄 넣으면 돼요.
import type { Template } from '../types';
import blog from './blog.json';
import meetingNotes from './meeting-notes.json';
import researchPaper from './research-paper.json';
import studyLog from './study-log.json';
import workLog from './work-log.json';

// JSON은 category 같은 값을 그냥 string으로 읽어서, Template 모양이라고 알려줘요. 모양은 contract 테스트가 확인해요.
export const templates = [workLog, studyLog, meetingNotes, blog, researchPaper] as Template[];
