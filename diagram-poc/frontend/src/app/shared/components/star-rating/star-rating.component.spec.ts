import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StarRatingComponent } from './star-rating.component';

describe('StarRatingComponent', () => {
  let fixture: ComponentFixture<StarRatingComponent>;
  let component: StarRatingComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [StarRatingComponent] }).compileComponents();
    fixture = TestBed.createComponent(StarRatingComponent);
    component = fixture.componentInstance;
  });

  it('renders `max` stars', () => {
    component.max = 5;
    expect(component.stars).toEqual([1, 2, 3, 4, 5]);
  });

  it('shows a half star for a fractional average in read-only mode', () => {
    component.readonly = true;
    component.rating = 3.5;
    expect(component.icon(3)).toBe('star');
    expect(component.icon(4)).toBe('star_half');
    expect(component.icon(5)).toBe('star_border');
  });

  it('emits ratingChange when interactive', () => {
    component.readonly = false;
    const spy = jasmine.createSpy('ratingChange');
    component.ratingChange.subscribe(spy);
    component.pick(4);
    expect(component.rating).toBe(4);
    expect(spy).toHaveBeenCalledWith(4);
  });

  it('does not change rating when read-only', () => {
    component.readonly = true;
    component.rating = 2;
    component.pick(5);
    expect(component.rating).toBe(2);
  });
});
