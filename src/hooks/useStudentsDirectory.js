import { useUsersDirectory } from './useUsersDirectory';

const byName = (a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR');

const selectActiveStudents = (users) =>
    users.filter((u) => u.role === 'student' && u.active === true).sort(byName);

const selectAllStudents = (users) =>
    users.filter((u) => u.role === 'student').sort(byName);

// Recorte de alunos sobre o diretório único (mesmo cache, nenhuma leitura extra).
export function useStudentsDirectory({ enabled = true, includeInactive = false } = {}) {
    return useUsersDirectory({
        enabled,
        select: includeInactive ? selectAllStudents : selectActiveStudents,
    });
}
