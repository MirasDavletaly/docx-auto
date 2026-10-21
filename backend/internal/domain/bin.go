package domain

// ValidIINBIN – ИИН или БИН Казахстана: 12 цифр, последняя – контрольная
// (CLAUDE.md, п. 3.9). Контрольная цифра – сумма первых 11 цифр с весами
// 1…11 по модулю 11; если вышло 10 – с весами 3…11, 1, 2; если снова 10 –
// номер недействителен.
func ValidIINBIN(s string) bool {
	if len(s) != 12 {
		return false
	}
	d := make([]int, 12)
	for i, c := range s {
		if c < '0' || c > '9' {
			return false
		}
		d[i] = int(c - '0')
	}
	sum := func(weights [11]int) int {
		total := 0
		for i, w := range weights {
			total += d[i] * w
		}
		return total % 11
	}
	check := sum([11]int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11})
	if check == 10 {
		check = sum([11]int{3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2})
		if check == 10 {
			return false
		}
	}
	return check == d[11]
}
