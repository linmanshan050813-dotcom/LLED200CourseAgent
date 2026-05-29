export const COURSE_MATERIAL_BY_FUNCTION_LEVEL = {
    content: {
        text: "LLED200 Academic Writing_ Representing Content V.5 2025.docx",
        section: "LLED200 Week 4 Definitions 2025.pptx",
        clause_word: "LLED200 Academic Writing_ Representing Content V.5 2025.docx",
    },
    interpersonal: {
        text: "Unit 3  Interpersonal Positioning & Citation v.03 July 9 2015.docx",
        section: "Unit 3  Interpersonal Positioning & Citation v.03 July 9 2015.docx",
        clause_word: "Hedging & Boosting in Research Writing in the Field of Artificial Intelligence.docx",
    },
    organization: {
        text: "Description_Model_Holocene Epoch_LLED 200_outline & clause analysis.docx",
        section: "Unit 6 Logic and Cohesion TEACHERS NOTES  v.03 July 9.docx",
        clause_word: "LLED200 Task Theme-New Organization in Academic Writing.docx",
    },
};
export function getCourseMaterialLabel(dimension, level) {
    return COURSE_MATERIAL_BY_FUNCTION_LEVEL[dimension][level];
}
