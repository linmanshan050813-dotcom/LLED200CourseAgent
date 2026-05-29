export const initialViewerState = {
    activeAnnotationId: null,
    currentTab: "annotations",
    functionFilter: "all",
    levelFilter: "all",
};
export function activate(state, annotationId) {
    return {
        ...state,
        activeAnnotationId: state.activeAnnotationId === annotationId ? null : annotationId,
    };
}
export function setFunctionFilter(state, filter) {
    return { ...state, functionFilter: filter };
}
export function setLevelFilter(state, filter) {
    return { ...state, levelFilter: filter };
}
export function switchTab(state, tab) {
    return { ...state, currentTab: tab };
}
export function filterAnnotations(annotations, state) {
    return annotations.filter((item) => {
        if (state.functionFilter !== "all" && item.function !== state.functionFilter) {
            return false;
        }
        if (state.levelFilter !== "all" && item.level !== state.levelFilter) {
            return false;
        }
        return true;
    });
}
