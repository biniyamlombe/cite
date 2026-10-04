# Spanish translation QA checklist

## Accuracy & completeness

- [ ] Meaning preserved; no omitted conditions/exceptions  
- [ ] Glossary terms used consistently  
- [ ] Numbers, dates, citations, bill IDs, URLs unchanged  
- [ ] Jurisdiction names preserved  

## Legal / applicability status

- [ ] Effective ≠ pending ≠ not-yet-effective ≠ failed/struck  
- [ ] Unknown never becomes “no aplica” / “no existe”  
- [ ] Hypothetical scenarios labeled as non-current law  
- [ ] Conflict → human review, not automated resolution  

## Authority boundaries

- [ ] English source quote visible and authoritative  
- [ ] Any Spanish quote translation labeled informational (if present)  
- [ ] “No es asesoramiento legal” visible in Spanish UI  
- [ ] Machine-generated badge shown when unreviewed  

## UX / a11y

- [ ] Language switcher keyboard accessible  
- [ ] `html[lang]` matches active locale  
- [ ] Aria labels / live regions in Spanish  
- [ ] No clipped Spanish buttons/labels at 320/375px  
- [ ] Status not color-only  

## Automation

- [ ] `npm test --prefix frontend -- i18n-parity spanish-localization`  
- [ ] `npm test -w backend -- --test-name-pattern locale`  
- [ ] No missing i18n keys / literal key leakage  

## Human sampling

- [ ] Reviewer scorecard completed for queue items  
- [ ] Back-translation used only as a signal (if at all)  
