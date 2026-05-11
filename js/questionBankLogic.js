const QuestionBankLogic = {

  async getAllQuestions() {
    try {
      const response = await fetch('/api/questions');
      return await response.json();
    } catch (err) {
      console.error('Fetch Error:', err);
      // Fallback if backend is down
      return window.QUESTION_BANK_DATA ? window.QUESTION_BANK_DATA.questions : [];
    }
  },

  async filterQuestions(filters) {
    try {
      const params = new URLSearchParams();
      if (filters.category && filters.category !== 'all') params.append('category', filters.category);
      if (filters.difficulty && filters.difficulty !== 'all') params.append('difficulty', filters.difficulty);
      if (filters.type && filters.type !== 'all') params.append('type', filters.type);
      if (filters.search) params.append('search', filters.search);
      if (filters.company && filters.company !== 'all' && filters.company !== '') params.append('company', filters.company);

      const response = await fetch(`/api/questions?${params.toString()}`);
      let questions = await response.json();

      return this.sortQuestions(questions, filters.sortBy);
    } catch (err) {
      console.error('Filter Fetch Error:', err);
      return [];
    }
  },

  sortQuestions(questions, sortBy) {
    const sorted = [...questions];
    switch(sortBy) {
      case 'newest':
        return sorted.sort((a,b) => b.year - a.year);
      case 'mostAsked':
        return sorted.sort((a,b) => b.times_asked - a.times_asked);
      case 'easyFirst':
        const order = {easy:0, medium:1, hard:2};
        return sorted.sort((a,b) => order[a.difficulty] - order[b.difficulty]);
      case 'hardFirst':
        const rOrder = {easy:2, medium:1, hard:0};
        return sorted.sort((a,b) => rOrder[a.difficulty] - rOrder[b.difficulty]);
      default: return sorted;
    }
  },

  async searchQuestions(query) {
    return this.filterQuestions({ search: query });
  },

  async getByCompany(company) {
    return this.filterQuestions({ company });
  },

  async getCompanySet(company) {
    // For now, this still comes from the JSON or we could implement an API
    return window.QUESTION_BANK_DATA ? window.QUESTION_BANK_DATA.companySets[company] : null;
  },

  async getStats() {
    const all = await this.getAllQuestions();
    return {
      total: all.length,
      byCategory: this.groupBy(all, 'category'),
      byDifficulty: this.groupBy(all, 'difficulty'),
      byType: this.groupBy(all, 'type'),
      mostAsked: [...all]
        .sort((a,b) => b.times_asked - a.times_asked)
        .slice(0, 5)
    };
  },

  groupBy(arr, key) {
    return arr.reduce((acc, item) => {
      acc[item[key]] = (acc[item[key]] || 0) + 1;
      return acc;
    }, {});
  },

  async getUserProgress() {
    // Check if user is logged in
    const authService = window.AuthService;
    if (authService && authService.isAuthenticated()) {
        try {
            const data = await authService.getProfile();
            const solvedIds = data.progress ? data.progress.questions_solved : [];
            const all = await this.getAllQuestions();
            const solvedQuestions = all.filter(q => solvedIds.includes(q.id));
            
            return {
              total: all.length,
              solved: solvedQuestions.length,
              percentage: Math.round((solvedQuestions.length / all.length) * 100) || 0,
              byCategory: Object.fromEntries(
                ['aptitude','dsa','technical','behavioral','hr'].map(cat => [
                  cat, {
                    total: all.filter(q=>q.category===cat).length,
                    solved: solvedQuestions.filter(q=>q.category===cat).length
                  }
                ])
              )
            };
        } catch (e) {
            console.error('Progress API Fail:', e);
        }
    }

    // Guest Fallback (localStorage)
    let solvedIds = [];
    try {
        solvedIds = JSON.parse(localStorage.getItem('placenix_solved') || '[]');
        solvedIds = solvedIds.map(s => typeof s === 'string' ? s : s.id);
    } catch {
        solvedIds = [];
    }

    const all = await this.getAllQuestions();
    const solvedQuestions = all.filter(q => solvedIds.includes(q.id));
    
    return {
      total: all.length,
      solved: solvedQuestions.length,
      percentage: Math.round((solvedQuestions.length / all.length) * 100) || 0,
      byCategory: Object.fromEntries(
        ['aptitude','dsa','technical','behavioral','hr'].map(cat => [
          cat, {
            total: all.filter(q=>q.category===cat).length,
            solved: solvedQuestions.filter(q=>q.category===cat).length
          }
        ])
      )
    };
  }
};

window.QuestionBankLogic = QuestionBankLogic;
