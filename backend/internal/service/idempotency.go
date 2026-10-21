package service

import (
	"bytes"
	"context"

	"github.com/jackc/pgx/v5/pgtype"

	"docflow/internal/access"
	"docflow/internal/domain"
	"docflow/internal/repository"
)

// Replay – сохранённый ответ на повтор запроса с тем же ключом.
type Replay struct {
	Status int
	Body   []byte
}

// IdempotencyBegin занимает ключ. Возвращает:
//   - nil, nil – ключ новый, запрос выполняется;
//   - ответ, nil – запрос уже выполнен, отдать сохранённый ответ;
//   - domain.ErrConflict – тот же запрос ещё выполняется;
//   - domain.ErrIdempotencyMismatch – ключ занят другим запросом.
func (s *Service) IdempotencyBegin(ctx context.Context, p access.Principal, key string, hash []byte) (*Replay, error) {
	var replay *Replay
	err := s.inTx(ctx, p, func(q *repository.Queries) error {
		_, err := q.IdempotencyBegin(ctx, repository.IdempotencyBeginParams{
			CompanyID: p.CompanyID, UserID: p.UserID, Key: key, RequestHash: hash,
		})
		if err == nil {
			return nil
		}
		if !isNoRows(err) {
			return err
		}
		row, err := q.IdempotencyGet(ctx, repository.IdempotencyGetParams{CompanyID: p.CompanyID, UserID: p.UserID, Key: key})
		if err != nil {
			return err
		}
		switch {
		case !bytes.Equal(row.RequestHash, hash):
			return domain.ErrIdempotencyMismatch
		case !row.Status.Valid:
			return domain.ErrConflict
		}
		replay = &Replay{Status: int(row.Status.Int32), Body: row.Response}
		return nil
	})
	return replay, err
}

// IdempotencyFinish сохраняет ответ для повторов.
func (s *Service) IdempotencyFinish(ctx context.Context, p access.Principal, key string, status int, body []byte) error {
	return s.inTx(ctx, p, func(q *repository.Queries) error {
		return q.IdempotencyFinish(ctx, repository.IdempotencyFinishParams{
			CompanyID: p.CompanyID, UserID: p.UserID, Key: key,
			Status:   pgtype.Int4{Int32: int32(status), Valid: true}, //nolint:gosec // код ответа HTTP
			Response: body,
		})
	})
}

// IdempotencyAbort освобождает ключ после сбоя сервера.
func (s *Service) IdempotencyAbort(ctx context.Context, p access.Principal, key string) error {
	return s.inTx(ctx, p, func(q *repository.Queries) error {
		return q.IdempotencyAbort(ctx, repository.IdempotencyAbortParams{CompanyID: p.CompanyID, UserID: p.UserID, Key: key})
	})
}
