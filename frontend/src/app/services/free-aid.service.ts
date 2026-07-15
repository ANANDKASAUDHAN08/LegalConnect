import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface EligibilityAnswers {
  gender: string;
  income: string;
  category: string;
}

@Injectable({
  providedIn: 'root'
})
export class FreeAidService {
  private eligibilityStepSubject = new BehaviorSubject<number>(0);
  eligibilityStep$ = this.eligibilityStepSubject.asObservable();

  private eligibilityAnswersSubject = new BehaviorSubject<EligibilityAnswers>({
    gender: '',
    income: '',
    category: ''
  });
  eligibilityAnswers$ = this.eligibilityAnswersSubject.asObservable();

  private isFreeAidEligibleSubject = new BehaviorSubject<boolean>(false);
  isFreeAidEligible$ = this.isFreeAidEligibleSubject.asObservable();

  get eligibilityStep(): number {
    return this.eligibilityStepSubject.value;
  }

  get eligibilityAnswers(): EligibilityAnswers {
    return this.eligibilityAnswersSubject.value;
  }

  get isFreeAidEligible(): boolean {
    return this.isFreeAidEligibleSubject.value;
  }

  startEligibilityCheck() {
    this.eligibilityStepSubject.next(1);
    this.eligibilityAnswersSubject.next({ gender: '', income: '', category: '' });
    this.isFreeAidEligibleSubject.next(false);
  }

  submitEligibilityStep(answers: EligibilityAnswers) {
    this.eligibilityAnswersSubject.next(answers);
    const isWomanOrChild = answers.gender === 'female' || answers.gender === 'other';
    const isScStOrWorkman = answers.category === 'sc' || answers.category === 'st' || answers.category === 'labour';
    const isLowIncome = answers.income === 'under125' || answers.income === 'under300';

    const eligible = !!(isWomanOrChild || isScStOrWorkman || isLowIncome);
    this.isFreeAidEligibleSubject.next(eligible);
    this.eligibilityStepSubject.next(2);
  }

  resetEligibilityCheck() {
    this.eligibilityStepSubject.next(0);
    this.isFreeAidEligibleSubject.next(false);
    this.eligibilityAnswersSubject.next({ gender: '', income: '', category: '' });
  }

  setStep(step: number) {
    this.eligibilityStepSubject.next(step);
  }
}