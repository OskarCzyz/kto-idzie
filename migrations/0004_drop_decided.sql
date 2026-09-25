-- "Decided" day status is gone: a day is either still open (wondering) or registered.
DELETE FROM day_status WHERE status = 'decided';
