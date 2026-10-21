package domain

import "testing"

func TestValidIINBIN(t *testing.T) {
	// БИН компаний группы из их реквизитов – настоящие, должны проходить.
	for _, bin := range []string{"251040008414", "200840900077", "131040015313", "250340002027", "170340025267", "250740021286"} {
		if !ValidIINBIN(bin) {
			t.Errorf("настоящий БИН отклонён: %s", bin)
		}
	}
	for _, bad := range []string{"", "12345", "25104000841a", "251040008415", "000000000011", "1234567890123"} {
		if ValidIINBIN(bad) {
			t.Errorf("неверный номер принят: %q", bad)
		}
	}
}
